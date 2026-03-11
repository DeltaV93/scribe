"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingIndicatorProps {
  isRecording: boolean;
  className?: string;
}

export function RecordingIndicator({ isRecording, className }: RecordingIndicatorProps) {
  if (isRecording) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400",
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <Mic className="h-3 w-3" />
        <span>Recording</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        className
      )}
    >
      <MicOff className="h-3 w-3" />
      <span>Not Recording</span>
    </div>
  );
}
