"use client";

import { useState, useEffect } from "react";
import { ClientAttendanceCard } from "./client-attendance-card";
import { Loader2 } from "lucide-react";
import type { ClientAttendanceReport } from "@/lib/services/attendance/types";

interface ClientAttendanceDetailProps {
  clientId: string;
}

export function ClientAttendanceDetail({
  clientId,
}: ClientAttendanceDetailProps) {
  const [report, setReport] = useState<ClientAttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/attendance/reports/client/${clientId}`)
      .then((r) => r.json())
      .then((d) => setReport(d.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [clientId]);

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
        No attendance data found
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">
        {report.client.firstName} {report.client.lastName} — Attendance
      </h2>

      {report.programs.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">
          Not enrolled in any programs
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {report.programs.map((program) => (
            <ClientAttendanceCard
              key={program.enrollmentId}
              program={program}
            />
          ))}
        </div>
      )}
    </div>
  );
}
