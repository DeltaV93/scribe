"use client";

import { Badge } from "@/components/ui/badge";
import { ObjectiveStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface ObjectiveStatusBadgeProps {
  status: ObjectiveStatus;
  className?: string;
}

const statusConfig: Record<
  ObjectiveStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  COMPLETED: { label: "Completed", variant: "outline" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export function ObjectiveStatusBadge({
  status,
  className,
}: ObjectiveStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === "COMPLETED" && "bg-green-100 text-green-800 border-green-200",
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
