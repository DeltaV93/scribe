"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CallTimerProps {
  startTime: Date | null;
  isActive: boolean;
}

export function CallTimer({ startTime, isActive }: CallTimerProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      return;
    }

    // Calculate initial duration
    const initialDuration = Math.floor(
      (Date.now() - startTime.getTime()) / 1000
    );
    setDuration(initialDuration);

    // Update every second
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 text-lg font-mono">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <span className={isActive ? "text-green-600" : "text-muted-foreground"}>
        {formatDuration(duration)}
      </span>
    </div>
  );
}

interface CallDurationDisplayProps {
  durationSeconds: number;
}

export function CallDurationDisplay({ durationSeconds }: CallDurationDisplayProps) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  };

  return <span>{formatDuration(durationSeconds)}</span>;
}
