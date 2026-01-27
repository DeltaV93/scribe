"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { SessionAttendanceSummary } from "./session-attendance-summary";
import { ExportReportButton } from "./export-report-button";
import { Loader2, Users, CalendarCheck, Clock, TrendingUp } from "lucide-react";
import type { ProgramAttendanceReport } from "@/lib/services/attendance/types";

interface ProgramAttendanceDashboardProps {
  programId: string;
}

export function ProgramAttendanceDashboard({
  programId,
}: ProgramAttendanceDashboardProps) {
  const [report, setReport] = useState<ProgramAttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/attendance/reports/program/${programId}`)
      .then((r) => r.json())
      .then((d) => setReport(d.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [programId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        No attendance data available
      </p>
    );
  }

  const stats = [
    {
      label: "Attendance Rate",
      value: `${Math.round(report.summary.overallAttendanceRate)}%`,
      icon: TrendingUp,
    },
    {
      label: "Sessions Recorded",
      value: `${report.summary.sessionsWithAttendance}/${report.summary.totalSessions}`,
      icon: CalendarCheck,
    },
    {
      label: "Total Hours",
      value: report.summary.totalHoursRecorded.toFixed(1),
      icon: Clock,
    },
    {
      label: "Active Enrollments",
      value: report.summary.activeEnrollments,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{report.program.name} — Attendance</h2>
        <ExportReportButton
          programId={programId}
          programName={report.program.name}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Summaries */}
      {report.sessionSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Summaries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.sessionSummaries.map((s) => (
                <SessionAttendanceSummary key={s.sessionId} summary={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enrollment Summaries */}
      {report.enrollmentSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead className="w-[200px]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.enrollmentSummaries.map((e) => (
                  <TableRow key={e.enrollmentId}>
                    <TableCell className="font-medium">
                      {e.clientName}
                    </TableCell>
                    <TableCell className="text-sm">{e.status}</TableCell>
                    <TableCell className="text-sm">
                      {e.sessionsAttended}/{e.totalSessions} ({Math.round(e.attendanceRate)}%)
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.hoursCompleted.toFixed(1)}
                      {e.hoursRemaining != null &&
                        ` / ${(e.hoursCompleted + e.hoursRemaining).toFixed(1)}`}
                    </TableCell>
                    <TableCell>
                      <Progress
                        value={
                          e.hoursRemaining != null
                            ? (e.hoursCompleted /
                                (e.hoursCompleted + e.hoursRemaining)) *
                              100
                            : e.attendanceRate
                        }
                        className="h-2"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
