"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SensitivityCategory, SensitivityTier, FlagReviewStatus } from "@prisma/client";

interface FlaggedSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  category: SensitivityCategory;
  confidence: number;
  suggestedTier: SensitivityTier;
  status: FlagReviewStatus;
  reviewNotes?: string;
}

interface SensitivityReviewProps {
  segments: FlaggedSegment[];
  onReview: (
    segmentId: string,
    decision: FlagReviewStatus,
    finalTier?: SensitivityTier,
    notes?: string
  ) => Promise<void>;
  className?: string;
}

const CATEGORY_INFO: Record<SensitivityCategory, { label: string; color: string; description: string }> = {
  PERSONAL_OFF_TOPIC: {
    label: "Personal/Off-Topic",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    description: "Personal conversations and non-work discussions",
  },
  HR_SENSITIVE: {
    label: "HR Sensitive",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    description: "Personnel matters, layoffs, terminations",
  },
  LEGAL_SENSITIVE: {
    label: "Legal Sensitive",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    description: "Legal discussions, compliance issues",
  },
  HEALTH_SENSITIVE: {
    label: "Health Sensitive",
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    description: "Medical information, health conditions",
  },
  FINANCIAL_SENSITIVE: {
    label: "Financial Sensitive",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    description: "Financial data, M&A, confidential business info",
  },
};

const TIER_INFO: Record<SensitivityTier, { label: string; icon: React.ReactNode; description: string }> = {
  REDACTED: {
    label: "Redact",
    icon: <EyeOff className="h-4 w-4" />,
    description: "Permanently remove from transcript",
  },
  RESTRICTED: {
    label: "Restricted",
    icon: <Shield className="h-4 w-4" />,
    description: "Visible only to participants + granted users",
  },
  STANDARD: {
    label: "Standard",
    icon: <Eye className="h-4 w-4" />,
    description: "No restrictions, normal access",
  },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function SensitivityReview({
  segments,
  onReview,
  className,
}: SensitivityReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTier, setSelectedTier] = useState<SensitivityTier | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingSegments = segments.filter((s) => s.status === "PENDING");
  const currentSegment = pendingSegments[currentIndex];

  if (pendingSegments.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">All Reviewed</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                All flagged content has been reviewed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDecision = async (decision: FlagReviewStatus) => {
    if (!currentSegment) return;

    setIsSubmitting(true);
    try {
      const finalTier =
        decision === "OVERRIDDEN" ? selectedTier : undefined;
      await onReview(currentSegment.id, decision, finalTier || undefined, notes || undefined);

      // Move to next
      setSelectedTier(null);
      setNotes("");
      if (currentIndex >= pendingSegments.length - 1) {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Review error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryInfo = CATEGORY_INFO[currentSegment.category];
  const suggestedTierInfo = TIER_INFO[currentSegment.suggestedTier];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sensitivity Review
          </CardTitle>
          <Badge variant="outline">
            {currentIndex + 1} of {pendingSegments.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category badge */}
        <div className="flex items-center gap-2">
          <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {Math.round(currentSegment.confidence * 100)}% confidence
          </span>
        </div>

        {/* Flagged text */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 text-xs text-muted-foreground">
            {formatTime(currentSegment.startTime)} - {formatTime(currentSegment.endTime)}
          </div>
          <p className="text-sm">"{currentSegment.text}"</p>
        </div>

        {/* Suggested action */}
        <div className="rounded-lg border p-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            AI Suggestion
          </div>
          <div className="flex items-center gap-2">
            {suggestedTierInfo.icon}
            <span className="font-medium">{suggestedTierInfo.label}</span>
            <span className="text-sm text-muted-foreground">
              — {suggestedTierInfo.description}
            </span>
          </div>
        </div>

        {/* Override tier selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Override tier (optional)</label>
          <Select
            value={selectedTier || ""}
            onValueChange={(value) =>
              setSelectedTier(value ? (value as SensitivityTier) : null)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Keep suggested tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REDACTED">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  Redact - Remove from transcript
                </div>
              </SelectItem>
              <SelectItem value="RESTRICTED">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Restricted - Limit access
                </div>
              </SelectItem>
              <SelectItem value="STANDARD">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Standard - No restrictions
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (optional)</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about your decision..."
            rows={2}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => handleDecision("DISMISSED")}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            Not Sensitive
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() =>
              handleDecision(selectedTier ? "OVERRIDDEN" : "APPROVED")
            }
            disabled={isSubmitting}
          >
            <Check className="h-4 w-4" />
            {selectedTier ? "Apply Override" : "Approve"}
          </Button>
        </div>

        {/* Navigation */}
        {pendingSegments.length > 1 && (
          <div className="flex justify-between pt-2 text-xs">
            <button
              onClick={() =>
                setCurrentIndex((i) =>
                  i > 0 ? i - 1 : pendingSegments.length - 1
                )
              }
              className="text-muted-foreground hover:text-foreground"
              disabled={isSubmitting}
            >
              ← Previous
            </button>
            <button
              onClick={() =>
                setCurrentIndex((i) =>
                  i < pendingSegments.length - 1 ? i + 1 : 0
                )
              }
              className="text-muted-foreground hover:text-foreground"
              disabled={isSubmitting}
            >
              Next →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
