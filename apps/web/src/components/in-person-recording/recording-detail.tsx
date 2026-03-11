"use client";

import { useState, useRef } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  FileText,
  User,
  Calendar,
  Pen,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingDetailProps {
  recording: {
    id: string;
    createdAt: string;
    duration: number | null;
    transcriptText: string | null;
    extractedData: Record<string, unknown> | null;
    confidenceScores: Record<string, number> | null;
    processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    processingError: string | null;
    consentMethod: "DIGITAL" | "VERBAL" | "PRE_SIGNED";
    consentRecordedAt: string;
    formIds: string[];
    client: {
      id: string;
      firstName: string;
      lastName: string;
    };
    user: {
      id: string;
      name: string | null;
      email: string;
    };
    playbackUrl?: string | null;
  };
  onProcess?: () => void;
  onRetry?: () => void;
  isProcessing?: boolean;
}

interface StatusConfigItem {
  label: string;
  icon: typeof Clock;
  color: string;
  bg: string;
  animate?: boolean;
}

const statusConfig: Record<string, StatusConfigItem> = {
  PENDING: {
    label: "Pending Processing",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  PROCESSING: {
    label: "Processing",
    icon: Loader2,
    color: "text-blue-600",
    bg: "bg-blue-50",
    animate: true,
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  FAILED: {
    label: "Failed",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
};

const consentMethodConfig = {
  DIGITAL: {
    label: "Digital Signature",
    icon: Pen,
    description: "Client provided digital signature on device",
  },
  VERBAL: {
    label: "Verbal Consent",
    icon: MessageSquare,
    description: "Client stated consent at beginning of recording",
  },
  PRE_SIGNED: {
    label: "Pre-Signed Consent",
    icon: FileText,
    description: "Referenced existing consent document on file",
  },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} seconds`;
  return `${mins} min ${secs} sec`;
}

function getConfidenceColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export function RecordingDetail({
  recording,
  onProcess,
  onRetry,
  isProcessing,
}: RecordingDetailProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const status = statusConfig[recording.processingStatus];
  const StatusIcon = status.icon;
  const consent = consentMethodConfig[recording.consentMethod];
  const ConsentIcon = consent.icon;

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="h-6 w-6" />
            Recording with {recording.client.firstName} {recording.client.lastName}
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(recording.createdAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("gap-1", status.color, status.bg)}
        >
          <StatusIcon
            className={cn("h-3 w-3", status.animate && "animate-spin")}
          />
          {status.label}
        </Badge>
      </div>

      {/* Audio Player (if completed) */}
      {recording.playbackUrl && recording.processingStatus === "COMPLETED" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                variant="outline"
                className="w-14 h-14 rounded-full"
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>
              <div className="flex-1">
                <audio
                  ref={audioRef}
                  src={recording.playbackUrl}
                  onEnded={handleAudioEnded}
                  className="w-full"
                  controls
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Actions */}
      {recording.processingStatus === "PENDING" && recording.duration && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Ready to process</p>
                  <p className="text-sm text-amber-700">
                    Click "Process Now" to transcribe and extract data from this recording.
                  </p>
                </div>
              </div>
              <Button onClick={onProcess} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process Now"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {recording.processingStatus === "FAILED" && recording.processingError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Processing failed</p>
                  <p className="text-sm text-red-700">{recording.processingError}</p>
                </div>
              </div>
              <Button variant="outline" onClick={onRetry} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Retry"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Transcript & Extraction */}
        <div className="lg:col-span-2 space-y-6">
          {recording.processingStatus === "COMPLETED" && (
            <Tabs defaultValue="transcript">
              <TabsList>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
              </TabsList>

              <TabsContent value="transcript" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transcript</CardTitle>
                    <CardDescription>
                      Full transcript of the recording
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] pr-4">
                      {recording.transcriptText ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {recording.transcriptText}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">
                          No transcript available.
                        </p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="extracted" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Extracted Data</CardTitle>
                    <CardDescription>
                      AI-extracted fields from the conversation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recording.extractedData &&
                    Object.keys(recording.extractedData).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(recording.extractedData).map(([key, value]) => {
                          const confidence = recording.confidenceScores?.[key] || 0;
                          return (
                            <div
                              key={key}
                              className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium capitalize">
                                  {key.replace(/_/g, " ")}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {String(value) || "Not detected"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span
                                  className={cn(
                                    "text-sm font-medium",
                                    getConfidenceColor(confidence)
                                  )}
                                >
                                  {confidence}%
                                </span>
                                <p className="text-xs text-muted-foreground">confidence</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No extracted data available. Make sure forms were selected for
                        this recording.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {(recording.processingStatus === "PENDING" ||
            recording.processingStatus === "PROCESSING") && (
            <Card>
              <CardContent className="py-12 text-center">
                {recording.processingStatus === "PROCESSING" ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
                    <p className="text-lg font-medium">Processing recording...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This may take a few minutes. You can leave this page and check
                      back later.
                    </p>
                  </>
                ) : (
                  <>
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Waiting for processing</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Transcript and extracted data will appear here after processing.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Recording Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recording Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(recording.duration)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Client</p>
                  <p className="text-sm text-muted-foreground">
                    {recording.client.firstName} {recording.client.lastName}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Recorded By</p>
                  <p className="text-sm text-muted-foreground">
                    {recording.user.name || recording.user.email}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(recording.createdAt), "PPP 'at' p")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consent Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", "bg-green-50")}>
                  <ConsentIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{consent.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {consent.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Recorded{" "}
                    {formatDistanceToNow(new Date(recording.consentRecordedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
