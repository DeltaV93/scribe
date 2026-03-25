"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Upload,
  Clock,
  Trash2,
  CheckCircle,
  AlertCircle,
  Play,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ManualUploadDialog } from "./manual-upload-dialog";
import type { RecoveryStatus } from "@prisma/client";

interface RecordingRecoveryPanelProps {
  conversationId: string;
  recoveryStatus: RecoveryStatus;
  hasRecording: boolean;
  lastHeartbeat: string | null;
  startedAt: string;
  durationSeconds: number | null;
  presignedUrlValid: boolean;
  onRecoveryComplete?: () => void;
}

type RecoveryAction = "process" | "upload" | "extend" | "abandon";

const RECOVERY_CONFIG: Record<
  RecoveryStatus,
  {
    title: string;
    description: string;
    icon: typeof RefreshCw;
    className: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  RECOVERABLE: {
    title: "Recording Recoverable",
    description:
      "Your recording was interrupted, but the audio was saved. You can process it now.",
    icon: CheckCircle,
    className: "border-green-400 bg-green-50 dark:bg-green-950/20",
    badgeVariant: "default",
  },
  AWAITING_UPLOAD: {
    title: "Awaiting Upload",
    description:
      "The recording was interrupted before the audio was uploaded. You can upload it manually if you have the file.",
    icon: Upload,
    className: "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
    badgeVariant: "outline",
  },
  EXPIRED: {
    title: "Upload Window Expired",
    description:
      "The upload window has expired and no recording was found. This recording cannot be recovered.",
    icon: AlertCircle,
    className: "border-red-400 bg-red-50 dark:bg-red-950/20",
    badgeVariant: "destructive",
  },
  ABANDONED: {
    title: "Recording Abandoned",
    description: "This recording was marked as abandoned.",
    icon: Trash2,
    className: "border-gray-400 bg-gray-50 dark:bg-gray-950/20",
    badgeVariant: "secondary",
  },
};

export function RecordingRecoveryPanel({
  conversationId,
  recoveryStatus,
  hasRecording,
  lastHeartbeat,
  startedAt,
  durationSeconds,
  presignedUrlValid,
  onRecoveryComplete,
}: RecordingRecoveryPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<RecoveryAction | null>(null);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = RECOVERY_CONFIG[recoveryStatus];
  const Icon = config.icon;

  const handleProcess = async () => {
    setIsLoading(true);
    setLoadingAction("process");
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/process`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to process recording");
      }

      onRecoveryComplete?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleExtendWindow = async () => {
    setIsLoading(true);
    setLoadingAction("extend");
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/fresh-upload-url`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to generate new upload URL");
      }

      // Refresh to show updated status
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleAbandon = async (deleteRecording: boolean = false) => {
    setIsLoading(true);
    setLoadingAction("abandon");
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteRecording,
          reason: "User abandoned stuck recording",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to abandon recording");
      }

      onRecoveryComplete?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
      setShowAbandonDialog(false);
    }
  };

  const handleUploadComplete = () => {
    setShowUploadDialog(false);
    onRecoveryComplete?.();
    router.refresh();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Card className={cn("border-2", config.className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "h-5 w-5",
                recoveryStatus === "RECOVERABLE" && "text-green-600",
                recoveryStatus === "AWAITING_UPLOAD" && "text-amber-600",
                recoveryStatus === "EXPIRED" && "text-red-600",
                recoveryStatus === "ABANDONED" && "text-gray-600"
              )}
            />
            <CardTitle className="text-lg">{config.title}</CardTitle>
            <Badge variant={config.badgeVariant} className="ml-auto">
              {recoveryStatus.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Explanation */}
          <p className="text-sm text-muted-foreground">{config.description}</p>

          {/* Status details */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>Started: {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}</span>
            {lastHeartbeat && (
              <span>
                Last seen: {formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true })}
              </span>
            )}
            {durationSeconds && durationSeconds > 0 && (
              <span>Duration: {formatDuration(durationSeconds)}</span>
            )}
            {hasRecording && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Audio found
              </Badge>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {recoveryStatus === "RECOVERABLE" && (
              <Button onClick={handleProcess} disabled={isLoading}>
                {loadingAction === "process" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Process Recording
              </Button>
            )}

            {recoveryStatus === "AWAITING_UPLOAD" && (
              <>
                <Button variant="outline" onClick={() => setShowUploadDialog(true)} disabled={isLoading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Manually
                </Button>
                {!presignedUrlValid && (
                  <Button variant="outline" onClick={handleExtendWindow} disabled={isLoading}>
                    {loadingAction === "extend" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Clock className="h-4 w-4 mr-2" />
                    )}
                    Extend Window
                  </Button>
                )}
              </>
            )}

            {recoveryStatus !== "ABANDONED" && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowAbandonDialog(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Abandon Recording
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Abandon confirmation dialog */}
      <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the recording as abandoned and it cannot be recovered.
              {hasRecording && (
                <span className="block mt-2 font-medium text-amber-600">
                  Note: Audio exists in storage. You can choose to delete it or keep it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            {hasRecording ? (
              <>
                <AlertDialogAction
                  onClick={() => handleAbandon(false)}
                  disabled={isLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {loadingAction === "abandon" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Keep Audio
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={() => handleAbandon(true)}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Audio
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => handleAbandon(false)}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {loadingAction === "abandon" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Abandon
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual upload dialog */}
      <ManualUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        conversationId={conversationId}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}
