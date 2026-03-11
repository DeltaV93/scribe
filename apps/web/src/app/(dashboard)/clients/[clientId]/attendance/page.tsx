"use client";

import { useParams } from "next/navigation";
import { ClientAttendanceDetail } from "@/components/attendance/reports/client-attendance-detail";

export default function ClientAttendancePage() {
  const params = useParams();
  const clientId = params.clientId as string;

  return (
    <div className="p-6">
      <ClientAttendanceDetail clientId={clientId} />
    </div>
  );
}
