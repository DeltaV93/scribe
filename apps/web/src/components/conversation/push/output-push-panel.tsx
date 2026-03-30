"use client";

/**
 * Output Push Panel Component (PX-1004)
 *
 * Main component for managing output push operations.
 * Integrates destination selection, push status, and sensitivity blocking.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Send,
  AlertTriangle,
  Shield,
  EyeOff,
  Check,
  X,
  Edit2,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  DestinationSelector,
  type IntegrationDestination,
} from "./destination-selector";
import {
  PushStatusBadge,
  MultiPushStatus,
  type PushJobInfo,
} from "./push-status-badge";
import { BulkActions, type OutputSummary } from "./bulk-actions";
import type {
  WorkflowOutputType,
  DraftStatus,
  IntegrationPlatform,
  SensitivityTier,
} from "@prisma/client";

// ============================================
// Types
// ============================================

export interface DraftedOutputWithPush {
  id: string;
  outputType: WorkflowOutputType;
  title: string | null;
  content: string;
  editedContent: string | null;
  metadata: Record<string, unknown> | null;
  sourceSnippet: string | null;
  status: DraftStatus;
  destinationPlatform: IntegrationPlatform | null;
  externalId: string | null;
  pushError: string | null;
  // Push-related fields
  pushJobs?: PushJobInfo[];
  sensitivityTier?: SensitivityTier;
  canPushExternally?: boolean;
  sensitivityReason?: string;
}

interface OutputPushPanelProps {
  /** Outputs to display */
  outputs: DraftedOutputWithPush[];
  /** Available integration destinations */
  destinations: IntegrationDestination[];
  /** Update output content */
  onUpdate: (id: string, data: { title?: string; content?: string }) => Promise<void>;
  /** Approve an output */
  onApprove: (id: string, platforms: IntegrationPlatform[]) => Promise<void>;
  /** Reject an output */
  onReject: (id: string) => Promise<void>;
  /** Push an output to selected destinations */
  onPush: (id: string, platforms: IntegrationPlatform[]) => Promise<void>;
  /** Retry a failed push */
  onRetry: (jobId: string) => Promise<void>;
  /** Bulk send all approved outputs */
  onSendAll: (outputIds: string[]) => Promise<void>;
  /** Bulk approve all pending outputs */
  onApproveAll?: (outputIds: string[]) => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Output Type Configuration
// ============================================

const OUTPUT_TYPE_INFO: Record<
  WorkflowOutputType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  ACTION_ITEM: {
    label: "Action Item",
    icon: <Check className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  MEETING_NOTES: {
    label: "Meeting Notes",
    icon: <Edit2 className="h-4 w-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  DOCUMENT: {
    label: "Document",
    icon: <Edit2 className="h-4 w-4" />,
    color: "text-violet-600 dark:text-violet-400",
  },
  CALENDAR_EVENT: {
    label: "Calendar Event",
    icon: <Edit2 className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
  },
  GOAL_UPDATE: {
    label: "Goal Update",
    icon: <Edit2 className="h-4 w-4" />,
    color: "text-pink-600 dark:text-pink-400",
  },
  DELAY_SIGNAL: {
    label: "Delay Signal",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-600 dark:text-red-400",
  },
};

const SENSITIVITY_INFO: Record<
  SensitivityTier,
  { label: string; icon: React.ReactNode; description: string }
> = {
  STANDARD: {
    label: "Standard",
    icon: <Check className="h-4 w-4" />,
    description: "Can be pushed to external integrations",
  },
  RESTRICTED: {
    label: "Restricted",
    icon: <Shield className="h-4 w-4" />,
    description: "Contains sensitive content - cannot push externally",
  },
  REDACTED: {
    label: "Redacted",
    icon: <EyeOff className="h-4 w-4" />,
    description: "Contains redacted content - cannot push externally",
  },
};

// ============================================
// Main Component
// ============================================

export function OutputPushPanel({
  outputs,
  destinations,
  onUpdate,
  onApprove,
  onReject,
  onPush,
  onRetry,
  onSendAll,
  onApproveAll,
  isLoading = false,
  className,
}: OutputPushPanelProps) {
  // Track selected destinations per output
  const [selectedDestinations, setSelectedDestinations] = useState<
    Record<string, IntegrationPlatform[]>
  >({});

  // Build summary for bulk actions
  const outputSummaries: OutputSummary[] = outputs.map((o) => ({
    id: o.id,
    status: o.status,
    destinationPlatforms: selectedDestinations[o.id] || [],
    canPush: o.canPushExternally !== false,
  }));

  // Handle destination change for an output
  const handleDestinationChange = (outputId: string, platforms: IntegrationPlatform[]) => {
    setSelectedDestinations((prev) => ({
      ...prev,
      [outputId]: platforms,
    }));
  };

  // Handle approve with destinations
  const handleApprove = async (outputId: string) => {
    const platforms = selectedDestinations[outputId] || [];
    await onApprove(outputId, platforms);
  };

  // Handle push with destinations
  const handlePush = async (outputId: string) => {
    const platforms = selectedDestinations[outputId] || [];
    if (platforms.length === 0) return;
    await onPush(outputId, platforms);
  };

  // Group outputs by type
  const groupedOutputs = outputs.reduce(
    (acc, output) => {
      const type = output.outputType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(output);
      return acc;
    },
    {} as Record<WorkflowOutputType, DraftedOutputWithPush[]>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bulk Actions Bar */}
      <BulkActions
        outputs={outputSummaries}
        onSendAll={onSendAll}
        onApproveAll={onApproveAll}
        isLoading={isLoading}
      />

      {/* Output Groups */}
      {Object.entries(groupedOutputs).map(([type, typeOutputs]) => {
        const typeInfo = OUTPUT_TYPE_INFO[type as WorkflowOutputType];

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-base", typeInfo.color)}>
                {typeInfo.icon}
                {typeInfo.label}s
                <Badge variant="secondary" className="ml-2">
                  {typeOutputs.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {typeOutputs.map((output) => (
                <OutputItem
                  key={output.id}
                  output={output}
                  destinations={destinations}
                  selectedDestinations={selectedDestinations[output.id] || []}
                  onDestinationChange={(platforms) =>
                    handleDestinationChange(output.id, platforms)
                  }
                  onUpdate={onUpdate}
                  onApprove={() => handleApprove(output.id)}
                  onReject={() => onReject(output.id)}
                  onPush={() => handlePush(output.id)}
                  onRetry={onRetry}
                  isLoading={isLoading}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// Individual Output Item
// ============================================

interface OutputItemProps {
  output: DraftedOutputWithPush;
  destinations: IntegrationDestination[];
  selectedDestinations: IntegrationPlatform[];
  onDestinationChange: (platforms: IntegrationPlatform[]) => void;
  onUpdate: (id: string, data: { title?: string; content?: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onPush: () => Promise<void>;
  onRetry: (jobId: string) => Promise<void>;
  isLoading: boolean;
}

function OutputItem({
  output,
  destinations,
  selectedDestinations,
  onDestinationChange,
  onUpdate,
  onApprove,
  onReject,
  onPush,
  onRetry,
  isLoading,
}: OutputItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(output.title || "");
  const [editContent, setEditContent] = useState(output.editedContent || output.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  const canPush = output.canPushExternally !== false;
  const sensitivityInfo = output.sensitivityTier
    ? SENSITIVITY_INFO[output.sensitivityTier]
    : null;

  // Filter destinations compatible with this output type
  const compatibleDestinations = destinations.map((d) => ({
    ...d,
    supportsOutputType: true, // API should handle this filtering
  }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(output.id, { title: editTitle, content: editContent });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await onPush();
    } finally {
      setIsPushing(false);
    }
  };

  const anyLoading = isLoading || isSaving || isApproving || isRejecting || isPushing;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              className="h-8 font-medium"
            />
          ) : (
            <h4 className="font-medium truncate">{output.title || "Untitled"}</h4>
          )}
        </div>

        {/* Status Badge */}
        <Badge
          variant={
            output.status === "PUSHED"
              ? "default"
              : output.status === "FAILED"
                ? "destructive"
                : output.status === "APPROVED"
                  ? "secondary"
                  : "outline"
          }
          className={output.status === "PUSHED" ? "bg-green-600" : undefined}
        >
          {output.status === "PENDING" && "Pending"}
          {output.status === "APPROVED" && "Approved"}
          {output.status === "REJECTED" && "Rejected"}
          {output.status === "PUSHED" && "Sent"}
          {output.status === "FAILED" && "Failed"}
        </Badge>
      </div>

      {/* Sensitivity Warning */}
      {!canPush && sensitivityInfo && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
          {sensitivityInfo.icon}
          <span className="font-medium">{sensitivityInfo.label}:</span>
          <span>{output.sensitivityReason || sensitivityInfo.description}</span>
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
      ) : (
        <p className="text-sm text-muted-foreground line-clamp-3">
          {output.editedContent || output.content}
        </p>
      )}

      {/* Source Snippet */}
      {output.sourceSnippet && !isEditing && (
        <div className="text-xs text-muted-foreground border-l-2 pl-2">
          <span className="font-medium">Source:</span> "{output.sourceSnippet}"
        </div>
      )}

      {/* Push Status (if has push jobs) */}
      {output.pushJobs && output.pushJobs.length > 0 && (
        <MultiPushStatus jobs={output.pushJobs} onRetry={onRetry} />
      )}

      {/* Destination Selector (for pending/approved outputs that can push) */}
      {(output.status === "PENDING" || output.status === "APPROVED") && canPush && (
        <div className="pt-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Push to:
          </label>
          <DestinationSelector
            destinations={compatibleDestinations}
            selected={selectedDestinations}
            onSelectionChange={onDestinationChange}
            outputType={output.outputType}
            canPush={canPush}
            disabledReason={output.sensitivityReason}
            compact
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        {isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={anyLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={anyLoading}
            >
              {isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Save
            </Button>
          </>
        ) : (
          <>
            {output.status === "PENDING" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={anyLoading}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReject}
                  disabled={anyLoading}
                >
                  {isRejecting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={anyLoading || !canPush}
                >
                  {isApproving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Check className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              </>
            )}

            {output.status === "APPROVED" && canPush && selectedDestinations.length > 0 && (
              <Button
                size="sm"
                onClick={handlePush}
                disabled={anyLoading}
              >
                {isPushing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <Send className="h-3 w-3 mr-1" />
                Push to {selectedDestinations.length} destination
                {selectedDestinations.length !== 1 ? "s" : ""}
              </Button>
            )}

            {output.status === "FAILED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePush}
                disabled={anyLoading}
              >
                {isPushing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Retry Push
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
