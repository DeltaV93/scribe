"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Phone,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface CallDraftReviewCardProps {
  draft: {
    id: string;
    callId: string;
    narrative: string;
    actionItems: string[];
    keyPoints: string[];
    sentiment: string | null;
    topics: string[];
    mappingType: string;
    confidence: number;
    createdAt: Date | string;
    clientName: string;
    callDate: Date | string;
  };
  onApprove: (draftId: string) => Promise<void>;
  onReject: (draftId: string) => Promise<void>;
  onEdit: (draftId: string, editedNarrative: string) => Promise<void>;
  isProcessing?: boolean;
}

const sentimentColors: Record<string, string> = {
  positive: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  concerned: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  distressed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const mappingTypeLabels: Record<string, string> = {
  client_linked: "Client Program",
  topic_matched: "AI Matched",
  manual: "Manual",
};

export function CallDraftReviewCard({
  draft,
  onApprove,
  onReject,
  onEdit,
  isProcessing = false,
}: CallDraftReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNarrative, setEditedNarrative] = useState(draft.narrative);

  const handleApprove = async () => {
    await onApprove(draft.id);
  };

  const handleReject = async () => {
    await onReject(draft.id);
  };

  const handleEdit = async () => {
    if (editedNarrative.trim() && editedNarrative !== draft.narrative) {
      await onEdit(draft.id, editedNarrative);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedNarrative(draft.narrative);
    setIsEditing(false);
  };

  const callDate = new Date(draft.callDate);
  const createdAt = new Date(draft.createdAt);

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        {/* Header with call info */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{draft.clientName}</span>
            <span>&bull;</span>
            <Clock className="h-3.5 w-3.5" />
            <span>{format(callDate, "MMM d, yyyy h:mm a")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                draft.mappingType === "topic_matched"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              )}
            >
              {draft.mappingType === "topic_matched" && (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {mappingTypeLabels[draft.mappingType] || draft.mappingType}
              {draft.mappingType === "topic_matched" && (
                <span className="ml-1">({Math.round(draft.confidence * 100)}%)</span>
              )}
            </Badge>
            {draft.sentiment && (
              <Badge
                variant="secondary"
                className={cn("text-xs capitalize", sentimentColors[draft.sentiment])}
              >
                {draft.sentiment}
              </Badge>
            )}
          </div>
        </div>

        {/* Narrative */}
        <div className="mb-3">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedNarrative}
                onChange={(e) => setEditedNarrative(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Edit the narrative..."
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEdit}
                  disabled={isProcessing || !editedNarrative.trim()}
                >
                  Save & Approve
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">{draft.narrative}</p>
          )}
        </div>

        {/* Expandable details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground hover:text-foreground"
            >
              <span className="text-xs">
                {draft.actionItems.length} action items &bull; {draft.keyPoints.length}{" "}
                key points
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            {/* Action Items */}
            {draft.actionItems.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Action Items
                </h4>
                <ul className="text-sm space-y-1">
                  {draft.actionItems.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Points */}
            {draft.keyPoints.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Key Points
                </h4>
                <ul className="text-sm space-y-1">
                  {draft.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground">&bull;</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics */}
            {draft.topics.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                  Topics
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {draft.topics.map((topic, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isProcessing}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReject}
                disabled={isProcessing}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1.5" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
