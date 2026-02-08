"use client";

import { Badge } from "@/components/ui/badge";
import { KeyResultStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface KeyResultStatusBadgeProps {
  status: KeyResultStatus;
  className?: string;
}

const statusConfig: Record<
  KeyResultStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  AT_RISK: { label: "At Risk", variant: "destructive" },
  COMPLETED: { label: "Completed", variant: "outline" },
};

export function KeyResultStatusBadge({
  status,
  className,
}: KeyResultStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === "COMPLETED" && "bg-green-100 text-green-800 border-green-200",
        status === "AT_RISK" && "bg-orange-100 text-orange-800 border-orange-200",
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
