"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AttendanceStatusBadge } from "../attendance-status-badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import type { ClientAttendanceReport } from "@/lib/services/attendance/types";

interface ClientAttendanceCardProps {
  program: ClientAttendanceReport["programs"][0];
}

export function ClientAttendanceCard({ program }: ClientAttendanceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hoursTotal =
    program.requiredHours != null ? program.requiredHours : null;
  const hoursPercent =
    hoursTotal != null && hoursTotal > 0
      ? Math.min(100, (program.hoursCompleted / hoursTotal) * 100)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{program.programName}</CardTitle>
          <span className="text-xs text-muted-foreground capitalize">
            {program.enrollmentStatus.toLowerCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hours progress */}
        {hoursPercent != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Hours Progress</span>
              <span>
                {program.hoursCompleted.toFixed(1)} / {hoursTotal} hrs
              </span>
            </div>
            <Progress value={hoursPercent} className="h-2" />
          </div>
        )}

        {/* Attendance rate */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Attendance Rate</span>
            <span>{Math.round(program.attendanceRate)}%</span>
          </div>
          <Progress value={program.attendanceRate} className="h-2" />
        </div>

        {/* Sessions toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="mr-1 h-3 w-3" />
          ) : (
            <ChevronDown className="mr-1 h-3 w-3" />
          )}
          {program.sessions.length} sessions
        </Button>

        {expanded && (
          <div className="space-y-1">
            {program.sessions.map((s) => (
              <div
                key={s.sessionId}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted"
              >
                <div>
                  <span className="font-medium">
                    #{s.sessionNumber} {s.sessionTitle}
                  </span>
                  {s.sessionDate && (
                    <span className="text-muted-foreground ml-2">
                      {format(new Date(s.sessionDate), "MMM d")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.hoursAttended != null && (
                    <span className="text-muted-foreground">
                      {s.hoursAttended}h
                    </span>
                  )}
                  <AttendanceStatusBadge status={s.attendanceType} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
