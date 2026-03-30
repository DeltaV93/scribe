"use client";

/**
 * Push Status Badge Component (PX-1004)
 *
 * Displays the status of a push job with appropriate styling and icons.
 * Shows different states: pending, processing, completed, failed.
 */

import { useState } from "react";
import {
  Clock,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IntegrationPlatform } from "@prisma/client";

// ============================================
// Types
// ============================================

export type PushJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface PushJobInfo {
  id: string;
  platform: IntegrationPlatform;
  status: PushJobStatus;
  attempt: number;
  maxAttempts: number;
  externalId?: string | null;
  externalUrl?: string | null;
  error?: string | null;
  nextRetryAt?: Date | null;
  completedAt?: Date | null;
}

interface PushStatusBadgeProps {
  /** Push job information */
  job: PushJobInfo;
  /** Called when user wants to retry a failed push */
  onRetry?: (jobId: string) => Promise<void>;
  /** Show platform name in badge */
  showPlatform?: boolean;
  /** Compact mode (smaller, no extras) */
  compact?: boolean;
  className?: string;
}

// ============================================
// Status Configurations
// ============================================

const STATUS_CONFIG: Record<
  PushJobStatus,
  {
    label: string;
    icon: React.ReactNode;
    variant: "default" | "secondary" | "outline" | "destructive";
    className: string;
  }
> = {
  PENDING: {
    label: "Queued",
    icon: <Clock className="h-3 w-3" />,
    variant: "outline",
    className: "text-muted-foreground",
  },
  PROCESSING: {
    label: "Sending",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: "secondary",
    className: "text-blue-600 dark:text-blue-400",
  },
  COMPLETED: {
    label: "Sent",
    icon: <Check className="h-3 w-3" />,
    variant: "default",
    className: "bg-green-600 hover:bg-green-600",
  },
  FAILED: {
    label: "Failed",
    icon: <AlertCircle className="h-3 w-3" />,
    variant: "destructive",
    className: "",
  },
};

const PLATFORM_NAMES: Record<IntegrationPlatform, string> = {
  NOTION: "Notion",
  LINEAR: "Linear",
  JIRA: "Jira",
  SLACK: "Slack",
  GOOGLE_CALENDAR: "Google Calendar",
  OUTLOOK_CALENDAR: "Outlook Calendar",
  GOOGLE_DOCS: "Google Docs",
};

// ============================================
// Main Component
// ============================================

export function PushStatusBadge({
  job,
  onRetry,
  showPlatform = false,
  compact = false,
  className,
}: PushStatusBadgeProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const config = STATUS_CONFIG[job.status];
  const platformName = PLATFORM_NAMES[job.platform];

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry(job.id);
    } finally {
      setIsRetrying(false);
    }
  };

  // Format retry time
  const formatRetryTime = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins <= 0) return "retrying soon";
    if (diffMins === 1) return "retry in 1 min";
    if (diffMins < 60) return `retry in ${diffMins} mins`;
    return `retry at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Simple compact badge
  if (compact) {
    return (
      <Badge
        variant={config.variant}
        className={cn("gap-1 text-xs", config.className, className)}
      >
        {config.icon}
        {showPlatform ? platformName : config.label}
      </Badge>
    );
  }

  // Full badge with tooltip and actions
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={config.variant}
              className={cn("gap-1 cursor-help", config.className)}
            >
              {config.icon}
              {showPlatform && <span>{platformName}:</span>}
              <span>{config.label}</span>
              {job.status === "FAILED" && job.attempt < job.maxAttempts && (
                <span className="text-xs opacity-75">
                  ({job.attempt}/{job.maxAttempts})
                </span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">
                {config.label} to {platformName}
              </p>

              {/* Success info */}
              {job.status === "COMPLETED" && job.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(job.completedAt).toLocaleString()}
                </p>
              )}

              {/* Error info */}
              {job.status === "FAILED" && job.error && (
                <p className="text-xs text-red-500">{job.error}</p>
              )}

              {/* Retry info */}
              {job.status === "PENDING" && job.nextRetryAt && (
                <p className="text-xs text-muted-foreground">
                  {formatRetryTime(new Date(job.nextRetryAt))}
                </p>
              )}

              {/* Attempt info */}
              {job.attempt > 1 && (
                <p className="text-xs text-muted-foreground">
                  Attempt {job.attempt} of {job.maxAttempts}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* External link for completed jobs */}
        {job.status === "COMPLETED" && job.externalUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={job.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Open in ${platformName}`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </TooltipTrigger>
            <TooltipContent>Open in {platformName}</TooltipContent>
          </Tooltip>
        )}

        {/* Retry button for failed jobs */}
        {job.status === "FAILED" && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Retry
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================
// Multi-Platform Status Display
// ============================================

interface MultiPushStatusProps {
  jobs: PushJobInfo[];
  onRetry?: (jobId: string) => Promise<void>;
  className?: string;
}

export function MultiPushStatus({
  jobs,
  onRetry,
  className,
}: MultiPushStatusProps) {
  if (jobs.length === 0) {
    return null;
  }

  // Group by status for summary
  const statusCounts = jobs.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    },
    {} as Record<PushJobStatus, number>
  );

  // Single job - show full badge
  if (jobs.length === 1) {
    return (
      <PushStatusBadge
        job={jobs[0]}
        onRetry={onRetry}
        showPlatform={true}
        className={className}
      />
    );
  }

  // Multiple jobs - show summary with expandable details
  const allCompleted = jobs.every((j) => j.status === "COMPLETED");
  const anyFailed = jobs.some((j) => j.status === "FAILED");
  const anyProcessing = jobs.some((j) => j.status === "PROCESSING");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Summary badge */}
      <div className="flex items-center gap-2">
        {allCompleted ? (
          <Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
            <Check className="h-3 w-3" />
            Sent to {jobs.length} destinations
          </Badge>
        ) : anyFailed ? (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {statusCounts.FAILED} failed, {statusCounts.COMPLETED || 0} sent
          </Badge>
        ) : anyProcessing ? (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sending to {jobs.length} destinations...
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Queued for {jobs.length} destinations
          </Badge>
        )}
      </div>

      {/* Individual status badges */}
      <div className="flex flex-wrap gap-2">
        {jobs.map((job) => (
          <PushStatusBadge
            key={job.id}
            job={job}
            onRetry={onRetry}
            showPlatform={true}
            compact={true}
          />
        ))}
      </div>
    </div>
  );
}
