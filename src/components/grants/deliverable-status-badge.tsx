"use client";

import { Badge } from "@/components/ui/badge";
import { DeliverableStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface DeliverableStatusBadgeProps {
  status: DeliverableStatus;
  className?: string;
}

const statusConfig: Record<
  DeliverableStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  AT_RISK: { label: "At Risk", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
};

export function DeliverableStatusBadge({ status, className }: DeliverableStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
