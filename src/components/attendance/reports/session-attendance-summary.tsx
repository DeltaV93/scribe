"use client";

import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

interface SessionSummary {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  sessionDate: Date | string | null;
  presentCount: number;
  excusedCount: number;
  absentCount: number;
  attendanceRate: number;
}

interface SessionAttendanceSummaryProps {
  summary: SessionSummary;
}

export function SessionAttendanceSummary({
  summary,
}: SessionAttendanceSummaryProps) {
  const rate = Math.round(summary.attendanceRate);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          #{summary.sessionNumber} {summary.sessionTitle}
        </span>
        <span className="text-xs text-muted-foreground">
          {summary.sessionDate
            ? format(new Date(summary.sessionDate), "MMM d")
            : ""}
        </span>
      </div>
      <Progress value={rate} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{rate}% attendance</span>
        <span>
          {summary.presentCount}P / {summary.excusedCount}E / {summary.absentCount}A
        </span>
      </div>
    </div>
  );
}
