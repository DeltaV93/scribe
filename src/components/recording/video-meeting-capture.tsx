"use client";

/**
 * Video Meeting Capture Component (PX-865)
 * UI for sending a bot to capture video meetings
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Clock,
  StopCircle,
} from "lucide-react";
import type { BotStatus } from "@/lib/meeting-bot/types";
import type { VideoPlatform } from "@prisma/client";

interface VideoMeetingCaptureProps {
  onCaptureStarted?: (conversationId: string, botId: string) => void;
  onCaptureEnded?: (conversationId: string) => void;
  onError?: (error: string) => void;
  defaultTitle?: string;
  clientIds?: string[];
  formIds?: string[];
}

interface BotStatusData {
  id: string;
  conversationId: string;
  platform: VideoPlatform;
  status: BotStatus;
  displayName: string;
  createdAt: string;
  joinedAt: string | null;
  participantCount: number | null;
  error: string | null;
}

const PLATFORM_INFO: Record<VideoPlatform, { name: string; icon: string; color: string }> = {
  ZOOM: { name: "Zoom", icon: "Z", color: "bg-blue-500" },
  GOOGLE_MEET: { name: "Google Meet", icon: "G", color: "bg-green-500" },
  MICROSOFT_TEAMS: { name: "Teams", icon: "T", color: "bg-purple-500" },
};

const STATUS_INFO: Record<
  BotStatus,
  { label: string; color: string; description: string }
> = {
  idle: { label: "Idle", color: "gray", description: "Bot is ready" },
  joining: { label: "Joining", color: "yellow", description: "Connecting to meeting..." },
  waiting_room: { label: "Waiting", color: "yellow", description: "Waiting to be admitted" },
  in_meeting: { label: "In Meeting", color: "blue", description: "Bot is in the meeting" },
  recording: { label: "Recording", color: "red", description: "Capturing audio" },
  leaving: { label: "Leaving", color: "yellow", description: "Leaving meeting..." },
  completed: { label: "Completed", color: "green", description: "Recording finished" },
  failed: { label: "Failed", color: "red", description: "An error occurred" },
  kicked: { label: "Removed", color: "red", description: "Bot was removed from meeting" },
};

export function VideoMeetingCapture({
  onCaptureStarted,
  onCaptureEnded,
  onError,
  defaultTitle,
  clientIds,
  formIds,
}: VideoMeetingCaptureProps) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState(defaultTitle || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatusData | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<VideoPlatform | null>(null);

  // Detect platform from URL
  useEffect(() => {
    const url = meetingUrl.trim().toLowerCase();
    if (url.includes("zoom.us") || url.includes("zoomgov.com")) {
      setDetectedPlatform("ZOOM");
    } else if (url.includes("meet.google.com") || url.includes("g.co/meet")) {
      setDetectedPlatform("GOOGLE_MEET");
    } else if (url.includes("teams.microsoft.com") || url.includes("teams.ms")) {
      setDetectedPlatform("MICROSOFT_TEAMS");
    } else {
      setDetectedPlatform(null);
    }
  }, [meetingUrl]);

  // Poll for bot status
  useEffect(() => {
    if (!botStatus?.id) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/meeting-bot/status/${botStatus.id}`);
        if (response.ok) {
          const data = await response.json();
          setBotStatus(data.data);

          // Check for completion
          if (data.data.status === "completed") {
            onCaptureEnded?.(data.data.conversationId);
          }
        }
      } catch (err) {
        console.error("Failed to poll bot status:", err);
      }
    };

    // Poll every 3 seconds while active
    const activeStatuses: BotStatus[] = ["joining", "waiting_room", "in_meeting", "recording", "leaving"];
    if (activeStatuses.includes(botStatus.status)) {
      const interval = setInterval(pollStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [botStatus?.id, botStatus?.status, onCaptureEnded]);

  const handleJoin = useCallback(async () => {
    if (!meetingUrl.trim()) {
      setError("Please enter a meeting URL");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/meeting-bot/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: meetingUrl.trim(),
          title: title.trim() || undefined,
          clientIds,
          formIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to join meeting");
      }

      // Set initial bot status
      setBotStatus({
        id: data.data.botId,
        conversationId: data.data.conversationId,
        platform: data.data.platform,
        status: "joining",
        displayName: "Inkra Notetaker",
        createdAt: new Date().toISOString(),
        joinedAt: null,
        participantCount: null,
        error: null,
      });

      onCaptureStarted?.(data.data.conversationId, data.data.botId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join meeting";
      setError(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [meetingUrl, title, clientIds, formIds, onCaptureStarted, onError]);

  const handleLeave = useCallback(async () => {
    if (!botStatus?.id) return;

    try {
      const response = await fetch("/api/meeting-bot/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: botStatus.id,
          reason: "user_requested",
        }),
      });

      if (response.ok) {
        setBotStatus((prev) => (prev ? { ...prev, status: "leaving" } : null));
      }
    } catch (err) {
      console.error("Failed to leave meeting:", err);
    }
  }, [botStatus?.id]);

  const handleReset = useCallback(() => {
    setBotStatus(null);
    setMeetingUrl("");
    setTitle(defaultTitle || "");
    setError(null);
  }, [defaultTitle]);

  // Render active capture state
  if (botStatus) {
    const statusInfo = STATUS_INFO[botStatus.status];
    const platformInfo = PLATFORM_INFO[botStatus.platform];
    const isActive = ["joining", "waiting_room", "in_meeting", "recording"].includes(
      botStatus.status
    );
    const isTerminal = ["completed", "failed", "kicked"].includes(botStatus.status);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full ${platformInfo.color} flex items-center justify-center text-white font-bold text-sm`}
              >
                {platformInfo.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{platformInfo.name} Capture</CardTitle>
                <CardDescription>{botStatus.displayName}</CardDescription>
              </div>
            </div>
            <Badge
              variant={
                statusInfo.color === "green"
                  ? "default"
                  : statusInfo.color === "red"
                  ? "destructive"
                  : "secondary"
              }
            >
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {botStatus.status === "recording" && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
            {botStatus.status === "joining" || botStatus.status === "waiting_room" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span>{statusInfo.description}</span>
          </div>

          {/* Meeting info */}
          <div className="space-y-2 text-sm">
            {botStatus.joinedAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Joined at {new Date(botStatus.joinedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            {botStatus.participantCount !== null && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{botStatus.participantCount} participants</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {botStatus.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{botStatus.error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {isActive && (
              <Button variant="destructive" onClick={handleLeave}>
                <StopCircle className="h-4 w-4 mr-2" />
                Stop Capture
              </Button>
            )}
            {isTerminal && (
              <Button onClick={handleReset}>
                Capture Another Meeting
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render initial form
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Video Meeting Capture
        </CardTitle>
        <CardDescription>
          Send Inkra Notetaker to capture a Zoom, Google Meet, or Microsoft Teams meeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Meeting URL input */}
        <div className="space-y-2">
          <Label htmlFor="meeting-url">Meeting URL</Label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="meeting-url"
              type="url"
              placeholder="https://zoom.us/j/123456789"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="pl-10"
              disabled={isSubmitting}
            />
          </div>
          {detectedPlatform && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Detected: {PLATFORM_INFO[detectedPlatform].name}</span>
            </div>
          )}
        </div>

        {/* Title input */}
        <div className="space-y-2">
          <Label htmlFor="meeting-title">Meeting Title (optional)</Label>
          <Input
            id="meeting-title"
            type="text"
            placeholder="Weekly Team Standup"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Supported platforms */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Supported:</span>
          {Object.entries(PLATFORM_INFO).map(([key, info]) => (
            <Badge key={key} variant="outline" className="text-xs">
              {info.name}
            </Badge>
          ))}
        </div>

        {/* Submit button */}
        <Button
          onClick={handleJoin}
          disabled={isSubmitting || !meetingUrl.trim()}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Joining Meeting...
            </>
          ) : (
            <>
              <Video className="h-4 w-4 mr-2" />
              Send Notetaker to Meeting
            </>
          )}
        </Button>

        {/* Info note */}
        <p className="text-xs text-muted-foreground">
          The Inkra Notetaker bot will join your meeting and record audio. Participants will see
          the bot as a participant named &quot;Inkra Notetaker&quot;.
        </p>
      </CardContent>
    </Card>
  );
}
