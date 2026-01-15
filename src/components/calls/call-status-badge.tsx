"use client";

import { Badge } from "@/components/ui/badge";
import { CallStatus } from "@prisma/client";

interface CallStatusBadgeProps {
  status: CallStatus;
}

const statusConfig: Record<
  CallStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  INITIATING: { label: "Initiating", variant: "outline" },
  RINGING: { label: "Ringing", variant: "warning" },
  IN_PROGRESS: { label: "In Progress", variant: "success" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  ABANDONED: { label: "Abandoned", variant: "destructive" },
  ATTEMPTED: { label: "Attempted", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
