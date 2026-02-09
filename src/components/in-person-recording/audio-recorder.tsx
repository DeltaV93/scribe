"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, Pause, Play, Square, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDurationMinutes?: number;
  className?: string;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

export function AudioRecorder({
  onRecordingComplete,
  maxDurationMinutes = 60,
  className,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const maxDurationSeconds = maxDurationMinutes * 60;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Analyze audio levels for visual feedback
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1

    if (state === "recording") {
      animationRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [state]);

  const startRecording = async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio analyzer
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create media recorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        onRecordingComplete(audioBlob, duration);
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setState("recording");
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          // Auto-stop at max duration
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      // Start audio level analysis
      analyzeAudio();
    } catch (err) {
      console.error("Error starting recording:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Microphone access was denied. Please allow microphone access to record.");
        } else if (err.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else {
          setError(`Failed to start recording: ${err.message}`);
        }
      } else {
        setError("Failed to start recording");
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");

      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= maxDurationSeconds) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);

      // Resume audio analysis
      analyzeAudio();
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (mediaRecorderRef.current && (state === "recording" || state === "paused")) {
      mediaRecorderRef.current.stop();
      setState("stopped");
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setAudioLevel(0);
  };

  const progress = (duration / maxDurationSeconds) * 100;
  const isNearLimit = duration > maxDurationSeconds * 0.9;

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardContent className="pt-6 space-y-6">
        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Timer and progress */}
        <div className="text-center space-y-2">
          <div className="text-5xl font-mono font-bold tracking-wider">
            {formatDuration(duration)}
          </div>
          <p className="text-sm text-muted-foreground">
            {state === "recording" && "Recording in progress"}
            {state === "paused" && "Recording paused"}
            {state === "idle" && "Ready to record"}
            {state === "stopped" && "Recording complete"}
          </p>
          {(state === "recording" || state === "paused") && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className={cn("text-xs", isNearLimit && "text-amber-600")}>
                {formatDuration(maxDurationSeconds - duration)} remaining
                {isNearLimit && " - approaching limit"}
              </p>
            </div>
          )}
        </div>

        {/* Audio level indicator */}
        {state === "recording" && (
          <div className="flex items-center justify-center gap-1 h-8">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 rounded-full transition-all duration-100",
                  i / 20 < audioLevel ? "bg-green-500" : "bg-gray-200"
                )}
                style={{
                  height: `${Math.max(4, Math.random() * 24 + 8)}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {state === "idle" && (
            <Button
              size="lg"
              onClick={startRecording}
              className="w-16 h-16 rounded-full"
            >
              <Mic className="h-6 w-6" />
            </Button>
          )}

          {state === "recording" && (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={pauseRecording}
                className="w-14 h-14 rounded-full"
              >
                <Pause className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                className="w-16 h-16 rounded-full"
              >
                <Square className="h-6 w-6" />
              </Button>
            </>
          )}

          {state === "paused" && (
            <>
              <Button
                size="lg"
                onClick={resumeRecording}
                className="w-14 h-14 rounded-full"
              >
                <Play className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                className="w-16 h-16 rounded-full"
              >
                <Square className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        {/* Instructions */}
        <p className="text-center text-sm text-muted-foreground">
          {state === "idle" && "Click the microphone to start recording"}
          {state === "recording" && "Click the square button to stop recording"}
          {state === "paused" && "Click play to resume or stop to finish"}
        </p>
      </CardContent>
    </Card>
  );
}
