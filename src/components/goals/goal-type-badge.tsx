"use client";

import { Badge } from "@/components/ui/badge";
import { GoalType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Target, TrendingUp, Briefcase, Users, User } from "lucide-react";

interface GoalTypeBadgeProps {
  type: GoalType;
  className?: string;
  showIcon?: boolean;
}

const typeConfig: Record<GoalType, { label: string; icon: typeof Target; className: string }> = {
  GRANT: {
    label: "Grant",
    icon: Target,
    className: "bg-purple-100 text-purple-700",
  },
  KPI: {
    label: "KPI",
    icon: TrendingUp,
    className: "bg-blue-100 text-blue-700",
  },
  OKR: {
    label: "OKR",
    icon: Target,
    className: "bg-indigo-100 text-indigo-700",
  },
  PROGRAM_INITIATIVE: {
    label: "Program",
    icon: Briefcase,
    className: "bg-teal-100 text-teal-700",
  },
  TEAM_INITIATIVE: {
    label: "Team",
    icon: Users,
    className: "bg-orange-100 text-orange-700",
  },
  INDIVIDUAL: {
    label: "Individual",
    icon: User,
    className: "bg-pink-100 text-pink-700",
  },
};

export function GoalTypeBadge({ type, className, showIcon = true }: GoalTypeBadgeProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn(config.className, "hover:bg-opacity-100", className)}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
