"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CallStatusBadge } from "@/components/calls/call-status-badge";
import { CallDurationDisplay } from "@/components/calls/call-timer";
import { CallStatus, ProcessingStatus } from "@prisma/client";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit,
  Save,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";

interface CallData {
  id: string;
  status: CallStatus;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  aiProcessingStatus: ProcessingStatus;
  aiSummary: {
    overview?: string;
    keyPoints?: string[];
    actionItems?: string[];
    nextSteps?: string[];
  } | null;
  extractedFields: Record<string, unknown> | null;
  confidenceScores: Record<string, number> | null;
  transcriptRaw: string | null;
  transcriptJson: Array<{
    speaker: string;
    text: string;
    timestamp: number;
  }> | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  caseManager: {
    id: string;
    name: string | null;
    email: string;
  };
  formSubmissions: Array<{
    id: string;
    status: string;
    form?: {
      id: string;
      name: string;
    };
  }>;
}

export default function CallReviewPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;

  const [call, setCall] = useState<CallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCall();
  }, [callId]);

  const fetchCall = async () => {
    try {
      const response = await fetch(`/api/calls/${callId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Call not found");
        } else {
          setError("Failed to load call");
        }
        return;
      }

      const data = await response.json();
      setCall(data.data);
      setEditedSummary(data.data.aiSummary?.overview || "");
    } catch (err) {
      setError("Failed to load call");
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) return <Badge variant="success">High</Badge>;
    if (score >= 60) return <Badge variant="warning">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  const handleSaveSummary = async () => {
    if (!call) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiSummary: {
            ...call.aiSummary,
            overview: editedSummary,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setIsEditingSummary(false);
      toast.success("Summary saved");
      fetchCall();
    } catch (err) {
      toast.error("Failed to save summary");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/calls">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Back to Calls</span>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{error || "Call not found"}</p>
          <Button className="mt-4" onClick={() => router.push("/calls")}>
            Go to Calls
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Call Review</h1>
          <p className="text-sm text-muted-foreground">
            {call.client.firstName} {call.client.lastName} -{" "}
            {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CallStatusBadge status={call.status} />
          {call.durationSeconds && (
            <div className="text-sm text-muted-foreground">
              <CallDurationDisplay durationSeconds={call.durationSeconds} />
            </div>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {call.aiProcessingStatus !== ProcessingStatus.COMPLETED && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {call.aiProcessingStatus === ProcessingStatus.PENDING ||
              call.aiProcessingStatus === ProcessingStatus.PROCESSING ? (
                <>
                  <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                  <span>AI processing in progress. This may take a few minutes...</span>
                </>
              ) : call.aiProcessingStatus === ProcessingStatus.FAILED ? (
                <>
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span>AI processing failed. Some features may be unavailable.</span>
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <span>Queued for processing...</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="extracted">Extracted Fields</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="forms">Forms ({call.formSubmissions.length})</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Call Summary</CardTitle>
                <CardDescription>AI-generated summary of the call</CardDescription>
              </div>
              {!isEditingSummary ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingSummary(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingSummary(false);
                      setEditedSummary(call.aiSummary?.overview || "");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveSummary} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isEditingSummary ? (
                <Textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  rows={4}
                  placeholder="Enter call summary..."
                />
              ) : (
                <p className="text-sm">
                  {call.aiSummary?.overview || "No summary available yet."}
                </p>
              )}
            </CardContent>
          </Card>

          {call.aiSummary?.keyPoints && call.aiSummary.keyPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {call.aiSummary.keyPoints.map((point, i) => (
                    <li key={i} className="text-sm">
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {call.aiSummary?.actionItems && call.aiSummary.actionItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {call.aiSummary.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Extracted Fields Tab */}
        <TabsContent value="extracted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Information</CardTitle>
              <CardDescription>
                Fields automatically extracted from the conversation. Review and
                correct as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {call.extractedFields && Object.keys(call.extractedFields).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(call.extractedFields).map(([key, value]) => {
                    const confidence = call.confidenceScores?.[key] || 0;
                    return (
                      <div key={key} className="grid grid-cols-3 gap-4 items-center">
                        <Label className="text-sm font-medium capitalize">
                          {key.replace(/_/g, " ")}
                        </Label>
                        <Input
                          value={String(value || "")}
                          onChange={() => {}}
                          className="col-span-1"
                        />
                        <div className="flex items-center gap-2">
                          {getConfidenceBadge(confidence)}
                          <span className={`text-sm ${getConfidenceColor(confidence)}`}>
                            {confidence}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No fields extracted yet. Processing may still be in progress.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Call Transcript</CardTitle>
              <CardDescription>
                Full transcript of the conversation with speaker labels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {call.transcriptJson && call.transcriptJson.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {call.transcriptJson.map((segment, i) => (
                      <div key={i} className="flex gap-3">
                        <Badge
                          variant={
                            segment.speaker === "CASE_MANAGER" ? "default" : "secondary"
                          }
                          className="shrink-0"
                        >
                          {segment.speaker === "CASE_MANAGER" ? "You" : "Client"}
                        </Badge>
                        <p className="text-sm">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : call.transcriptRaw ? (
                <ScrollArea className="h-[500px]">
                  <p className="text-sm whitespace-pre-wrap">{call.transcriptRaw}</p>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transcript available yet. Processing may still be in progress.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>Form Submissions</CardTitle>
              <CardDescription>
                Forms associated with this call
              </CardDescription>
            </CardHeader>
            <CardContent>
              {call.formSubmissions.length > 0 ? (
                <div className="space-y-3">
                  {call.formSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        router.push(`/forms/${submission.form?.id}/submissions/${submission.id}`)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{submission.form?.name}</span>
                      </div>
                      <Badge variant={submission.status === "COMPLETED" ? "success" : "secondary"}>
                        {submission.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No forms were selected for this call.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push(`/clients/${call.client.id}`)}>
          View Client Profile
        </Button>
        <Button onClick={() => router.push("/calls")}>
          Done
        </Button>
      </div>
    </div>
  );
}
