"use client";

import { useState } from "react";
import { Clock, Repeat, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateTimePicker } from "./DateTimePicker";

type RecurrenceFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  daysOfWeek?: number[];
  until?: string;
}

interface Tier2PendingCardProps {
  item: {
    id: string;
    clientName: string;
    extractedContext: string;
    extractedDateHint?: string;
    hasRecurrence: boolean;
    recurrencePattern?: string;
    tier: "TIER_2_VAGUE";
    createdAt: string;
  };
  onApprove: (params: {
    pendingItemId: string;
    startTime: string;
    endTime?: string;
    recurrence?: RecurrenceConfig;
  }) => Promise<void>;
  onDismiss: (pendingItemId: string) => Promise<void>;
  className?: string;
}

/**
 * Tier2PendingCard - Displays a pending scheduling item that needs review
 *
 * Shows amber clock icon, extracted context, optional date hint, and recurrence info.
 * Provides "Schedule" button to open inline DateTimePicker and "Dismiss" button.
 */
export function Tier2PendingCard({
  item,
  onApprove,
  onDismiss,
  className,
}: Tier2PendingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleApprove = async (params: {
    startTime: string;
    endTime?: string;
    recurrence?: RecurrenceConfig;
  }) => {
    await onApprove({
      pendingItemId: item.id,
      ...params,
    });
    setIsExpanded(false);
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await onDismiss(item.id);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <Card className={cn("border-amber-200 bg-amber-50/50", className)}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {/* Pending icon */}
          <div className="flex-shrink-0 mt-0.5">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  Follow-up with {item.clientName}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {item.extractedContext}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="warning" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Needs scheduling
              </Badge>

              {item.extractedDateHint && (
                <Badge variant="outline" className="text-xs">
                  Suggested: {item.extractedDateHint}
                </Badge>
              )}

              {item.hasRecurrence && (
                <Badge variant="outline" className="text-xs">
                  <Repeat className="h-3 w-3 mr-1" />
                  {item.recurrencePattern || "Recurring"}
                </Badge>
              )}
            </div>

            {/* Actions */}
            {!isExpanded && (
              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                >
                  Schedule
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={isDismissing}
                >
                  {isDismissing ? (
                    "Dismissing..."
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Dismiss
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Expanded DateTimePicker */}
            {isExpanded && (
              <div className="mt-4">
                <DateTimePicker
                  showRecurrence={item.hasRecurrence}
                  recurrenceHint={item.recurrencePattern}
                  onConfirm={handleApprove}
                  onCancel={() => setIsExpanded(false)}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Tier2PendingCard;
