"use client";

import { Badge } from "@/components/ui/badge";
import { GrantStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface GrantStatusBadgeProps {
  status: GrantStatus;
  className?: string;
}

const statusConfig: Record<
  GrantStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "success" },
  COMPLETED: { label: "Completed", variant: "default" },
  EXPIRED: { label: "Expired", variant: "warning" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

export function GrantStatusBadge({ status, className }: GrantStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
