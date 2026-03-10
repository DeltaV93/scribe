"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SensitivityCategory } from "@prisma/client";

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
  isFlagged?: boolean;
  flagCategory?: SensitivityCategory;
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  flaggedSegments?: Array<{
    startTime: number;
    endTime: number;
    category: SensitivityCategory;
    status: string;
  }>;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  highlightTime?: number;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const CATEGORY_COLORS: Record<SensitivityCategory, string> = {
  PERSONAL_OFF_TOPIC: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  HR_SENSITIVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  LEGAL_SENSITIVE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HEALTH_SENSITIVE: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  FINANCIAL_SENSITIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const CATEGORY_LABELS: Record<SensitivityCategory, string> = {
  PERSONAL_OFF_TOPIC: "Personal",
  HR_SENSITIVE: "HR",
  LEGAL_SENSITIVE: "Legal",
  HEALTH_SENSITIVE: "Health",
  FINANCIAL_SENSITIVE: "Financial",
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({
  segments,
  flaggedSegments = [],
  onSegmentClick,
  highlightTime,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: TranscriptViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Enrich segments with flag info
  const enrichedSegments = useMemo(() => {
    return segments.map((segment) => {
      const flag = flaggedSegments.find(
        (f) =>
          segment.startTime >= f.startTime &&
          segment.endTime <= f.endTime &&
          f.status === "PENDING"
      );

      return {
        ...segment,
        isFlagged: !!flag,
        flagCategory: flag?.category,
      };
    });
  }, [segments, flaggedSegments]);

  // Group consecutive segments by speaker
  const groupedSegments = useMemo(() => {
    const groups: Array<{
      speaker?: string;
      segments: TranscriptSegment[];
      startTime: number;
      endTime: number;
    }> = [];

    for (const segment of enrichedSegments) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.speaker === segment.speaker) {
        lastGroup.segments.push(segment);
        lastGroup.endTime = segment.endTime;
      } else {
        groups.push({
          speaker: segment.speaker,
          segments: [segment],
          startTime: segment.startTime,
          endTime: segment.endTime,
        });
      }
    }

    return groups;
  }, [enrichedSegments]);

  const pendingFlags = flaggedSegments.filter((f) => f.status === "PENDING").length;

  if (collapsible) {
    return (
      <div className={cn("border rounded-lg", className)}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">Transcript</span>
            {pendingFlags > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {pendingFlags} flagged
              </Badge>
            )}
          </div>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        {!isCollapsed && (
          <div className="border-t p-4">
            <TranscriptContent
              groups={groupedSegments}
              onSegmentClick={onSegmentClick}
              highlightTime={highlightTime}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <TranscriptContent
        groups={groupedSegments}
        onSegmentClick={onSegmentClick}
        highlightTime={highlightTime}
      />
    </div>
  );
}

interface TranscriptContentProps {
  groups: Array<{
    speaker?: string;
    segments: TranscriptSegment[];
    startTime: number;
    endTime: number;
  }>;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  highlightTime?: number;
}

function TranscriptContent({
  groups,
  onSegmentClick,
  highlightTime,
}: TranscriptContentProps) {
  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => {
        const hasFlaggedContent = group.segments.some((s) => s.isFlagged);

        return (
          <div
            key={groupIndex}
            className={cn(
              "rounded-lg p-3",
              hasFlaggedContent
                ? "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
                : "bg-muted/50"
            )}
          >
            {/* Speaker header */}
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="font-medium">
                {group.speaker || "Unknown Speaker"}
              </span>
              <span>•</span>
              <span>{formatTime(group.startTime)}</span>
            </div>

            {/* Segment content */}
            <div className="space-y-1">
              {group.segments.map((segment, segIndex) => {
                const isHighlighted =
                  highlightTime !== undefined &&
                  highlightTime >= segment.startTime &&
                  highlightTime <= segment.endTime;

                return (
                  <div
                    key={segIndex}
                    className={cn(
                      "inline",
                      segment.isFlagged && "relative",
                      isHighlighted && "bg-yellow-200 dark:bg-yellow-900/50",
                      onSegmentClick && "cursor-pointer hover:bg-muted"
                    )}
                    onClick={() => onSegmentClick?.(segment)}
                  >
                    {segment.text === "[REDACTED]" ? (
                      <span className="rounded bg-gray-200 px-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        [REDACTED]
                      </span>
                    ) : (
                      <>
                        {segment.text}{" "}
                        {segment.isFlagged && segment.flagCategory && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "ml-1 inline-flex text-[10px]",
                              CATEGORY_COLORS[segment.flagCategory]
                            )}
                          >
                            <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                            {CATEGORY_LABELS[segment.flagCategory]}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
