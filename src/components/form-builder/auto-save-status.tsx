"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import type { AutoSaveStatus } from "@/hooks/use-auto-save";

interface AutoSaveStatusBarProps {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  retriesRemaining: number;
  onRetry: () => void;
  className?: string;
}

/**
 * Status bar component for displaying auto-save state.
 * Shows at the bottom of the form builder, always visible.
 */
export function AutoSaveStatusBar({
  status,
  lastSavedAt,
  error,
  retriesRemaining,
  onRetry,
  className,
}: AutoSaveStatusBarProps) {
  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Don't show anything in idle state without a last save
  if (status === "idle" && !lastSavedAt) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-2 px-4 text-sm border-t bg-muted/30",
        status === "error" && "bg-destructive/10 border-destructive/20",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">
            {retriesRemaining < 3 ? "Retrying save..." : "Saving..."}
          </span>
        </>
      )}

      {status === "saved" && lastSavedAt && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">
            Saved at {formatTime(lastSavedAt)}
          </span>
        </>
      )}

      {status === "idle" && lastSavedAt && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">All changes saved</span>
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">
            {error || "Save failed"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-7 gap-1 text-destructive hover:text-destructive"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </>
      )}
    </div>
  );
}
