"use client";

import { Badge } from "@/components/ui/badge";
import type { AttendanceType } from "@prisma/client";

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  PRESENT: { label: "Present", variant: "success" },
  EXCUSED: { label: "Excused", variant: "warning" },
  ABSENT: { label: "Absent", variant: "destructive" },
};

interface AttendanceStatusBadgeProps {
  status: AttendanceType | null | undefined;
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  if (!status) {
    return <Badge variant="secondary">Not Recorded</Badge>;
  }

  const config = statusConfig[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
