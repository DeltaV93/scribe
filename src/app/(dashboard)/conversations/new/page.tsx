"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Users, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InPersonRecorder } from "@/components/recording/in-person-recorder";

interface ConversationSetup {
  conversationId?: string;
  uploadUrl?: string;
  maxDurationMinutes?: number;
}

export default function NewConversationPage() {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "recording" | "complete">("setup");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState("");
  const [conversationSetup, setConversationSetup] = useState<ConversationSetup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Update conversation to trigger processing
      fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PROCESSING",
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
          <h1 className="text-xl font-bold">New Recording</h1>
          <p className="text-sm text-muted-foreground">
            Start an in-person conversation recording
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recording Details
          </CardTitle>
          <CardDescription>
            Provide optional details about this recording
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
    </div>
  );
}
