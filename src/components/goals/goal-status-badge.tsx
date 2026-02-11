"use client";

import { Badge } from "@/components/ui/badge";
import { GoalStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface GoalStatusBadgeProps {
  status: GoalStatus;
  className?: string;
}

const statusConfig: Record<GoalStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    variant: "secondary",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  },
  IN_PROGRESS: {
    label: "In Progress",
    variant: "default",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  },
  ON_TRACK: {
    label: "On Track",
    variant: "default",
    className: "bg-green-100 text-green-700 hover:bg-green-100",
  },
  AT_RISK: {
    label: "At Risk",
    variant: "default",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  },
  BEHIND: {
    label: "Behind",
    variant: "destructive",
    className: "bg-red-100 text-red-700 hover:bg-red-100",
  },
  COMPLETED: {
    label: "Completed",
    variant: "default",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },
};

export function GoalStatusBadge({ status, className }: GoalStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
