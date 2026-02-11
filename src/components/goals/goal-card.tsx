"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GoalStatusBadge } from "./goal-status-badge";
import { GoalTypeBadge } from "./goal-type-badge";
import { GoalProgress } from "./goal-progress";
import { GoalStatus, GoalType } from "@prisma/client";
import { Calendar, User, Users, Link2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface GoalCardProps {
  goal: {
    id: string;
    name: string;
    description: string | null;
    type: GoalType;
    status: GoalStatus;
    progress: number;
    startDate: string | null;
    endDate: string | null;
    ownerName: string | null;
    teamName: string | null;
    _count?: {
      grants: number;
      objectives: number;
      kpis: number;
      programs: number;
    };
  };
  onClick?: () => void;
  className?: string;
}

export function GoalCard({ goal, onClick, className }: GoalCardProps) {
  const totalLinkedItems =
    (goal._count?.grants || 0) +
    (goal._count?.objectives || 0) +
    (goal._count?.kpis || 0);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/20",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{goal.name}</h3>
            {goal.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {goal.description}
              </p>
            )}
          </div>
          <GoalTypeBadge type={goal.type} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <GoalStatusBadge status={goal.status} />
            <span className="text-sm font-medium">{goal.progress}%</span>
          </div>
          <GoalProgress progress={goal.progress} status={goal.status} showLabel={false} />
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {goal.endDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Due {format(new Date(goal.endDate), "MMM d, yyyy")}</span>
            </div>
          )}
          {goal.ownerName && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>{goal.ownerName}</span>
            </div>
          )}
          {goal.teamName && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{goal.teamName}</span>
            </div>
          )}
          {totalLinkedItems > 0 && (
            <div className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              <span>{totalLinkedItems} linked</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
