"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, Square, Pause, Play, AlertCircle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  WebRecorder,
  isRecordingSupported,
  requestMicrophonePermission,
  type RecordingState,
} from "@/lib/recording";
import { uploadToPresignedUrl } from "@/lib/recording/upload";

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Generate or retrieve a persistent device ID for this session
function getDeviceId(): string {
  const storageKey = "inkra-device-id";
  let deviceId = sessionStorage.getItem(storageKey);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    sessionStorage.setItem(storageKey, deviceId);
  }
  return deviceId;
}

interface InPersonRecorderProps {
  conversationId?: string;
  uploadUrl?: string;
  maxDurationMinutes?: number;
  onRecordingStart?: () => void;
  onRecordingStop?: (duration: number) => void;
  onUploadComplete?: (conversationId: string) => void;
  onError?: (error: string) => void;
}

export function InPersonRecorder({
  conversationId,
  uploadUrl,
  maxDurationMinutes = 60,
  onRecordingStart,
  onRecordingStop,
  onUploadComplete,
  onError,
}: InPersonRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("inactive");
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);

  const recorderRef = useRef<WebRecorder | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  // Initialize device ID on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      deviceIdRef.current = getDeviceId();
    }
  }, []);

  // Heartbeat effect - sends heartbeat every 30 seconds while recording
  useEffect(() => {
    if (!conversationId || !deviceIdRef.current) return;

    const sendHeartbeat = async () => {
      if (recordingState !== "recording" && recordingState !== "paused") return;

      try {
        const response = await fetch(`/api/conversations/${conversationId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: deviceIdRef.current,
            recordingState,
            durationSeconds: duration,
          }),
        });

        if (!response.ok) {
          console.warn("[Heartbeat] Failed to send heartbeat:", response.status);
        } else {
          const data = await response.json();
          if (!data.shouldContinue && data.message) {
            console.warn("[Heartbeat] Server warning:", data.message);
          }
        }
      } catch (err) {
        console.warn("[Heartbeat] Error sending heartbeat:", err);
      }
    };

    if (recordingState === "recording" || recordingState === "paused") {
      // Send immediate heartbeat on state change
      sendHeartbeat();

      // Set up interval
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    } else {
      // Clear interval when not recording
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [recordingState, conversationId, duration]);

  // Check browser support and permissions
  useEffect(() => {
    if (!isRecordingSupported()) {
      setError("Your browser does not support audio recording");
      return;
    }

    requestMicrophonePermission().then(setPermissionStatus);
  }, []);

  // Duration timer
  useEffect(() => {
    if (recordingState === "recording") {
      durationIntervalRef.current = setInterval(() => {
        setDuration((d) => {
          const newDuration = d + 1;
          // Auto-stop at max duration
          if (newDuration >= maxDurationMinutes * 60) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [recordingState, maxDurationMinutes]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      const recorder = new WebRecorder({
        onStateChange: setRecordingState,
        onAudioLevel: setAudioLevel,
        onError: (err) => {
          setError(err.message);
          onError?.(err.message);
        },
      });

      recorderRef.current = recorder;
      await recorder.start();
      setDuration(0);
      onRecordingStart?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start recording";
      setError(message);
      onError?.(message);
    }
  }, [onRecordingStart, onError]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    try {
      const result = await recorderRef.current.stop();
      onRecordingStop?.(result.duration);

      // Upload if we have a URL
      if (uploadUrl && conversationId) {
        setIsUploading(true);
        setUploadProgress(0);

        await uploadToPresignedUrl(uploadUrl, result.blob, (percent) => {
          setUploadProgress(percent);
        });

        setIsUploading(false);
        onUploadComplete?.(conversationId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop recording";
      setError(message);
      onError?.(message);
      setIsUploading(false);
    }
  }, [uploadUrl, conversationId, onRecordingStop, onUploadComplete, onError]);

  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  const cancelRecording = useCallback(() => {
    recorderRef.current?.cancel();
    setDuration(0);
    setAudioLevel(0);
  }, []);

  // Permission denied state
  if (permissionStatus === "denied") {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-600 dark:text-red-400">
                Microphone Access Denied
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Please enable microphone access in your browser settings to record.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && recordingState === "inactive") {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-600 dark:text-amber-400">
                Recording Error
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => setError(null)}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="h-5 w-5" />
          In-Person Recording
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording indicator */}
        {recordingState !== "inactive" && (
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                recordingState === "recording"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              )}
            >
              {recordingState === "recording" && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
              )}
              <span>
                {recordingState === "recording" ? "Recording" : "Paused"}
              </span>
            </div>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        )}

        {/* Audio level meter */}
        {recordingState === "recording" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                Audio Level
              </span>
              <span>{Math.round(audioLevel)}%</span>
            </div>
            <Progress value={audioLevel} className="h-2" />
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Max duration warning */}
        {recordingState === "recording" && duration > (maxDurationMinutes - 5) * 60 && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Recording will stop in {formatDuration(maxDurationMinutes * 60 - duration)}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {recordingState === "inactive" ? (
            <Button
              size="lg"
              onClick={startRecording}
              disabled={isUploading}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              Start Recording
            </Button>
          ) : (
            <>
              {recordingState === "recording" ? (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={pauseRecording}
                  className="h-10 w-10"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resumeRecording}
                  className="h-10 w-10"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="destructive"
                size="lg"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            </>
          )}
        </div>

        {/* Cancel option */}
        {recordingState !== "inactive" && !isUploading && (
          <div className="text-center">
            <button
              onClick={cancelRecording}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel and discard
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
