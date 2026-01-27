"use client";

import { useParams } from "next/navigation";
import { ProgramAttendanceDashboard } from "@/components/attendance/reports/program-attendance-dashboard";

export default function ProgramAttendancePage() {
  const params = useParams();
  const programId = params.programId as string;

  return (
    <div className="p-6">
      <ProgramAttendanceDashboard programId={programId} />
    </div>
  );
}
