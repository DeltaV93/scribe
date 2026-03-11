"use client";

import { Badge } from "@/components/ui/badge";
import { ClientStatus } from "@prisma/client";

interface ClientStatusBadgeProps {
  status: ClientStatus;
}

const statusConfig: Record<
  ClientStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  ACTIVE: { label: "Active", variant: "success" },
  ON_HOLD: { label: "On Hold", variant: "warning" },
  CLOSED: { label: "Closed", variant: "secondary" },
  PENDING: { label: "Pending", variant: "outline" },
};

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
