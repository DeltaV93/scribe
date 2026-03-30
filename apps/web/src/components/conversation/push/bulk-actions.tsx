"use client";

/**
 * Bulk Actions Component (PX-1004)
 *
 * Provides bulk operations for outputs:
 * - "Send All Approved" - Push all approved outputs to their destinations
 * - Stats summary (pending, approved, sent, failed)
 */

import { useState } from "react";
import {
  Send,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DraftStatus, IntegrationPlatform } from "@prisma/client";

// ============================================
// Types
// ============================================

export interface OutputSummary {
  id: string;
  status: DraftStatus;
  destinationPlatforms: IntegrationPlatform[];
  canPush: boolean;
}

interface BulkActionsProps {
  /** All outputs to summarize */
  outputs: OutputSummary[];
  /** Called when user wants to send all approved outputs */
  onSendAll: (outputIds: string[]) => Promise<void>;
  /** Called when user wants to approve all pending outputs */
  onApproveAll?: (outputIds: string[]) => Promise<void>;
  /** Called when user wants to reject all pending outputs */
  onRejectAll?: (outputIds: string[]) => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Main Component
// ============================================

export function BulkActions({
  outputs,
  onSendAll,
  onApproveAll,
  onRejectAll,
  isLoading = false,
  className,
}: BulkActionsProps) {
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Calculate stats
  const stats = {
    total: outputs.length,
    pending: outputs.filter((o) => o.status === "PENDING").length,
    approved: outputs.filter(
      (o) => o.status === "APPROVED" && o.destinationPlatforms.length > 0 && o.canPush
    ).length,
    pushed: outputs.filter((o) => o.status === "PUSHED").length,
    failed: outputs.filter((o) => o.status === "FAILED").length,
    rejected: outputs.filter((o) => o.status === "REJECTED").length,
  };

  // Get IDs for bulk operations
  const pendingIds = outputs.filter((o) => o.status === "PENDING").map((o) => o.id);
  const approvedIds = outputs
    .filter((o) => o.status === "APPROVED" && o.destinationPlatforms.length > 0 && o.canPush)
    .map((o) => o.id);

  const handleSendAll = async () => {
    if (approvedIds.length === 0) return;
    setIsSending(true);
    try {
      await onSendAll(approvedIds);
    } finally {
      setIsSending(false);
    }
  };

  const handleApproveAll = async () => {
    if (!onApproveAll || pendingIds.length === 0) return;
    setIsApproving(true);
    try {
      await onApproveAll(pendingIds);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectAll = async () => {
    if (!onRejectAll || pendingIds.length === 0) return;
    setIsRejecting(true);
    try {
      await onRejectAll(pendingIds);
    } finally {
      setIsRejecting(false);
    }
  };

  const anyLoading = isLoading || isSending || isApproving || isRejecting;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card",
        className
      )}
    >
      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          {stats.total} outputs
        </span>

        {stats.pending > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {stats.pending} pending
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Awaiting review</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {stats.approved > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  {stats.approved} ready to send
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Approved with destinations selected</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {stats.pushed > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="gap-1 bg-green-600 hover:bg-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {stats.pushed} sent
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Successfully pushed to integrations</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {stats.failed > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {stats.failed} failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Failed to push - click to retry</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Approve All */}
        {onApproveAll && stats.pending > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={anyLoading}
                className="gap-1"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve all pending outputs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will approve {stats.pending} pending output
                  {stats.pending !== 1 ? "s" : ""}. You can still edit them before
                  pushing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleApproveAll}>
                  Approve All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Reject All */}
        {onRejectAll && stats.pending > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={anyLoading}
                className="gap-1 text-muted-foreground hover:text-destructive"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject all pending outputs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reject {stats.pending} pending output
                  {stats.pending !== 1 ? "s" : ""}. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRejectAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reject All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Send All */}
        {stats.approved > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={anyLoading || stats.approved === 0}
                className="gap-1"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send All ({stats.approved})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send all approved outputs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will push {stats.approved} approved output
                  {stats.approved !== 1 ? "s" : ""} to their selected
                  integrations. You can track progress and retry failures
                  individually.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendAll}>
                  <Send className="h-4 w-4 mr-2" />
                  Send All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// ============================================
// Compact Stats Bar (for page header)
// ============================================

interface CompactStatsProps {
  outputs: OutputSummary[];
  className?: string;
}

export function CompactStats({ outputs, className }: CompactStatsProps) {
  const stats = {
    total: outputs.length,
    pending: outputs.filter((o) => o.status === "PENDING").length,
    approved: outputs.filter((o) => o.status === "APPROVED").length,
    pushed: outputs.filter((o) => o.status === "PUSHED").length,
    failed: outputs.filter((o) => o.status === "FAILED").length,
  };

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">{stats.total} outputs:</span>

      {stats.pending > 0 && (
        <span className="text-amber-600 dark:text-amber-400">
          {stats.pending} pending
        </span>
      )}

      {stats.approved > 0 && (
        <span className="text-blue-600 dark:text-blue-400">
          {stats.approved} ready
        </span>
      )}

      {stats.pushed > 0 && (
        <span className="text-green-600 dark:text-green-400">
          {stats.pushed} sent
        </span>
      )}

      {stats.failed > 0 && (
        <span className="text-red-600 dark:text-red-400">
          {stats.failed} failed
        </span>
      )}
    </div>
  );
}
