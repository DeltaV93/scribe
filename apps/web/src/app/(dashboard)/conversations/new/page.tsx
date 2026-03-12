"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Video, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InPersonRecorder } from "@/components/recording/in-person-recorder";
import { VideoMeetingCapture } from "@/components/recording/video-meeting-capture";

interface ConversationSetup {
  conversationId?: string;
  uploadUrl?: string;
  uploadKey?: string;
  maxDurationMinutes?: number;
}

type CaptureMode = "in-person" | "video";

export default function NewConversationPage() {
  const router = useRouter();
  const [mode, setMode] = useState<CaptureMode>("in-person");
  const [step, setStep] = useState<"setup" | "recording" | "complete">("setup");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const [conversationSetup, setConversationSetup] = useState<ConversationSetup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoMeetingEnabled, setVideoMeetingEnabled] = useState<boolean | null>(null);

  // Check if video meeting bot is enabled
  useEffect(() => {
    fetch("/api/features/video-meeting-bot")
      .then((res) => res.json())
      .then((data) => setVideoMeetingEnabled(data.enabled))
      .catch(() => setVideoMeetingEnabled(false));
  }, []);

  const handleStartRecording = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/conversations/in-person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          location: location || undefined,
          participants: participants
            ? participants.split(",").map((p) => ({ name: p.trim() }))
            : [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to create conversation");
      }

      setConversationSetup({
        conversationId: data.conversation.id,
        uploadUrl: data.upload.url,
        uploadKey: data.upload.key,
        maxDurationMinutes: data.maxDurationMinutes,
      });
      setStep("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRecordingStart = useCallback(() => {
    // Recording started
  }, []);

  const handleRecordingStop = useCallback((duration: number) => {
    console.log("Recording stopped, duration:", duration);
  }, []);

  const handleUploadComplete = useCallback(
    (conversationId: string) => {
      // Update conversation with recording URL and trigger processing
      fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PROCESSING",
          recordingUrl: conversationSetup?.uploadKey,
          endedAt: new Date().toISOString(),
        }),
      }).then(() => {
        setStep("complete");
        // Redirect to review page after short delay
        setTimeout(() => {
          router.push(`/conversations/${conversationId}`);
        }, 2000);
      });
    },
    [router, conversationSetup?.uploadKey]
  );

  const handleVideoCapture = useCallback(
    (conversationId: string) => {
      router.push(`/conversations/${conversationId}`);
    },
    [router]
  );

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  if (step === "complete") {
    return (
      <div className="container max-w-2xl py-12">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
              <Mic className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Recording Complete</h2>
            <p className="mt-2 text-muted-foreground text-center">
              Your recording has been uploaded and is being processed.
              <br />
              Redirecting to review...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "recording" && conversationSetup) {
    return (
      <div className="container max-w-2xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm("Are you sure? Recording will be lost.")) {
                setStep("setup");
                setConversationSetup(null);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{title || "In-Person Recording"}</h1>
            {location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </p>
            )}
          </div>
        </div>

        {/* Consent notice */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Recording Notice:</strong> This meeting is being recorded.
              The recording will be transcribed and processed by Inkra.
              Please ensure all participants have consented.
            </p>
          </CardContent>
        </Card>

        <InPersonRecorder
          conversationId={conversationSetup.conversationId}
          uploadUrl={conversationSetup.uploadUrl}
          maxDurationMinutes={conversationSetup.maxDurationMinutes}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onUploadComplete={handleUploadComplete}
          onError={handleError}
        />

        {error && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="py-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Conversation Capture</h1>
          <p className="text-sm text-muted-foreground">
            Record an in-person meeting or capture a video call
          </p>
        </div>
      </div>

      {/* Capture Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as CaptureMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="in-person" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            In-Person
          </TabsTrigger>
          <TabsTrigger
            value="video"
            className="flex items-center gap-2"
            disabled={videoMeetingEnabled === false}
          >
            <Video className="h-4 w-4" />
            Video Meeting
            {videoMeetingEnabled === false && (
              <Badge variant="secondary" className="ml-1 text-xs">
                Coming Soon
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* In-Person Recording Tab */}
        <TabsContent value="in-person" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                In-Person Recording
              </CardTitle>
              <CardDescription>
                Record a conversation using your device&apos;s microphone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Weekly Standup, Client Intake"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g., Conference Room A"
                    className="pl-9"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="participants">Participants (optional)</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="participants"
                    placeholder="e.g., John, Sarah, Mike"
                    className="pl-9"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Separate names with commas
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleStartRecording}
                disabled={isCreating}
              >
                <Mic className="mr-2 h-4 w-4" />
                {isCreating ? "Setting up..." : "Start Recording"}
              </Button>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recording Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Place device near speakers for best audio quality</p>
              <p>• Minimize background noise</p>
              <p>• Announce that the meeting is being recorded</p>
              <p>• Recording will be automatically transcribed and processed</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Meeting Tab */}
        <TabsContent value="video" className="space-y-4 mt-4">
          {videoMeetingEnabled ? (
            <VideoMeetingCapture
              defaultTitle={title}
              onCaptureStarted={(conversationId) => {
                // Stay on page to show status
              }}
              onCaptureEnded={handleVideoCapture}
              onError={handleError}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4">
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-semibold">Video Meeting Capture</h3>
                <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
                  Send a bot to automatically capture Zoom, Google Meet, or Microsoft Teams meetings.
                  This feature is coming soon.
                </p>
                <Badge variant="secondary" className="mt-4">
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Video meeting tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Paste your meeting link and we&apos;ll send a bot to join</p>
              <p>• The bot appears as &quot;Inkra Notetaker&quot; in the participant list</p>
              <p>• Audio is recorded and transcribed automatically</p>
              <p>• Meeting host may need to admit the bot from the waiting room</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
