"use client";

import { useState } from "react";
import {
  CheckSquare,
  FileText,
  Calendar,
  Target,
  AlertTriangle,
  Check,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Edit2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { WorkflowOutputType, DraftStatus, IntegrationPlatform } from "@prisma/client";

interface DraftedOutput {
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
}

interface OutputEditorProps {
  outputs: DraftedOutput[];
  onUpdate: (id: string, data: { title?: string; content?: string }) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onPush: (id: string) => Promise<void>;
  availableIntegrations?: IntegrationPlatform[];
  className?: string;
}

const OUTPUT_TYPE_INFO: Record<
  WorkflowOutputType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  ACTION_ITEM: {
    label: "Action Items",
    icon: <CheckSquare className="h-4 w-4" />,
    color: "text-blue-600 dark:text-blue-400",
  },
  MEETING_NOTES: {
    label: "Meeting Notes",
    icon: <FileText className="h-4 w-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  DOCUMENT: {
    label: "Documents",
    icon: <FileText className="h-4 w-4" />,
    color: "text-violet-600 dark:text-violet-400",
  },
  CALENDAR_EVENT: {
    label: "Calendar Events",
    icon: <Calendar className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
  },
  GOAL_UPDATE: {
    label: "Goal Updates",
    icon: <Target className="h-4 w-4" />,
    color: "text-pink-600 dark:text-pink-400",
  },
  DELAY_SIGNAL: {
    label: "Delay Signals",
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-red-600 dark:text-red-400",
  },
};

const STATUS_BADGES: Record<DraftStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING: { label: "Pending", variant: "outline" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  PUSHED: { label: "Pushed", variant: "secondary" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function OutputEditor({
  outputs,
  onUpdate,
  onApprove,
  onReject,
  onPush,
  availableIntegrations = [],
  className,
}: OutputEditorProps) {
  // Group outputs by type
  const groupedOutputs = outputs.reduce(
    (acc, output) => {
      const type = output.outputType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(output);
      return acc;
    },
    {} as Record<WorkflowOutputType, DraftedOutput[]>
  );

  const pendingCount = outputs.filter((o) => o.status === "PENDING").length;
  const approvedCount = outputs.filter((o) => o.status === "APPROVED").length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{outputs.length} outputs generated</span>
        {pendingCount > 0 && (
          <Badge variant="outline">{pendingCount} pending review</Badge>
        )}
        {approvedCount > 0 && (
          <Badge variant="secondary">{approvedCount} approved</Badge>
        )}
      </div>

      {/* Output groups */}
      {Object.entries(groupedOutputs).map(([type, typeOutputs]) => {
        const typeInfo = OUTPUT_TYPE_INFO[type as WorkflowOutputType];

        return (
          <OutputGroup
            key={type}
            type={type as WorkflowOutputType}
            typeInfo={typeInfo}
            outputs={typeOutputs}
            onUpdate={onUpdate}
            onApprove={onApprove}
            onReject={onReject}
            onPush={onPush}
          />
        );
      })}
    </div>
  );
}

interface OutputGroupProps {
  type: WorkflowOutputType;
  typeInfo: { label: string; icon: React.ReactNode; color: string };
  outputs: DraftedOutput[];
  onUpdate: (id: string, data: { title?: string; content?: string }) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onPush: (id: string) => Promise<void>;
}

function OutputGroup({
  type,
  typeInfo,
  outputs,
  onUpdate,
  onApprove,
  onReject,
  onPush,
}: OutputGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className={cn("flex items-center gap-2 text-base", typeInfo.color)}>
                {typeInfo.icon}
                {typeInfo.label}
                <Badge variant="secondary" className="ml-2">
                  {outputs.length}
                </Badge>
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {outputs.map((output) => (
              <OutputItem
                key={output.id}
                output={output}
                onUpdate={onUpdate}
                onApprove={onApprove}
                onReject={onReject}
                onPush={onPush}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface OutputItemProps {
  output: DraftedOutput;
  onUpdate: (id: string, data: { title?: string; content?: string }) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onPush: (id: string) => Promise<void>;
}

function OutputItem({ output, onUpdate, onApprove, onReject, onPush }: OutputItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(output.title || "");
  const [editContent, setEditContent] = useState(output.editedContent || output.content);
  const [isLoading, setIsLoading] = useState(false);

  const statusInfo = STATUS_BADGES[output.status];

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onUpdate(output.id, { title: editTitle, content: editContent });
      setIsEditing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(output.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(output.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    setIsLoading(true);
    try {
      await onPush(output.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-8"
            />
          ) : (
            <h4 className="font-medium truncate">{output.title || "Untitled"}</h4>
          )}
        </div>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      </div>

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

      {/* Source snippet */}
      {output.sourceSnippet && !isEditing && (
        <div className="text-xs text-muted-foreground border-l-2 pl-2">
          <span className="font-medium">Source:</span> "{output.sourceSnippet}"
        </div>
      )}

      {/* External link */}
      {output.externalId && output.status === "PUSHED" && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Pushed as: {output.externalId}</span>
        </div>
      )}

      {/* Error message */}
      {output.pushError && (
        <div className="text-xs text-red-600 dark:text-red-400">
          Error: {output.pushError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isEditing ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              Save
            </Button>
          </>
        ) : (
          <>
            {output.status === "PENDING" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={isLoading}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
                <Button size="sm" onClick={handleApprove} disabled={isLoading}>
                  <Check className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              </>
            )}
            {output.status === "APPROVED" && output.destinationPlatform && (
              <Button size="sm" onClick={handlePush} disabled={isLoading}>
                <Send className="h-3 w-3 mr-1" />
                Push to {output.destinationPlatform}
              </Button>
            )}
            {output.status === "FAILED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePush}
                disabled={isLoading}
              >
                Retry Push
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
