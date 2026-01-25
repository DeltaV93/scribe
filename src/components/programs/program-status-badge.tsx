"use client";

import { Badge } from "@/components/ui/badge";
import { ProgramStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface ProgramStatusBadgeProps {
  status: ProgramStatus;
  className?: string;
}

export function ProgramStatusBadge({ status, className }: ProgramStatusBadgeProps) {
  const statusConfig: Record<
    ProgramStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    DRAFT: { label: "Draft", variant: "secondary" },
    ACTIVE: { label: "Active", variant: "default" },
    COMPLETED: { label: "Completed", variant: "outline" },
    CANCELLED: { label: "Cancelled", variant: "destructive" },
    ARCHIVED: { label: "Archived", variant: "secondary" },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
