"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
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

interface ConflictCardProps {
  item: {
    id: string;
    clientName: string;
    extractedContext: string;
    extractedDateHint?: string;
    hasRecurrence: boolean;
    recurrencePattern?: string;
    tier: "TIER_1_CONFLICT";
    conflictDetails?: {
      conflictingEventTitle: string;
      conflictingEventTime: string;
    };
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
 * ConflictCard - Displays a Tier 1 item that had a calendar conflict
 *
 * Shows red warning icon, conflict details, and allows rescheduling to a different time.
 */
export function ConflictCard({
  item,
  onApprove,
  onDismiss,
  className,
}: ConflictCardProps) {
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

  const conflictTime = item.conflictDetails?.conflictingEventTime
    ? new Date(item.conflictDetails.conflictingEventTime)
    : null;

  return (
    <Card className={cn("border-red-200 bg-red-50/50", className)}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {/* Warning icon */}
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">
                  Calendar conflict detected
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Could not auto-schedule follow-up with {item.clientName}
                </p>
              </div>
            </div>

            {/* Conflict details */}
            {item.conflictDetails && (
              <div className="mt-3 p-3 bg-red-100/50 rounded-lg">
                <p className="text-sm font-medium text-red-800">
                  Conflicts with: {item.conflictDetails.conflictingEventTitle}
                </p>
                {conflictTime && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-red-700">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>
                      {format(conflictTime, "MMM d, yyyy")} at{" "}
                      {format(conflictTime, "h:mm a")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Original context */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Original scheduling intent:</p>
              <p className="text-sm text-foreground mt-1">{item.extractedContext}</p>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Conflict
              </Badge>

              {item.extractedDateHint && (
                <Badge variant="outline" className="text-xs">
                  Original: {item.extractedDateHint}
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
                  Choose different time
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={isDismissing}
                >
                  {isDismissing ? "Dismissing..." : "Dismiss"}
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

export default ConflictCard;
