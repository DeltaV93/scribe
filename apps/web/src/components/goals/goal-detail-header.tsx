"use client";

import { Button } from "@/components/ui/button";
import { GoalStatusBadge } from "./goal-status-badge";
import { GoalTypeBadge } from "./goal-type-badge";
import { GoalProgress } from "./goal-progress";
import { GoalStatus, GoalType } from "@prisma/client";
import {
  ArrowLeft,
  Calendar,
  Edit,
  MoreHorizontal,
  Trash2,
  User,
  Users,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface GoalDetailHeaderProps {
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
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function GoalDetailHeader({
  goal,
  onEdit,
  onDelete,
  onDuplicate,
}: GoalDetailHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/goals"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Goals
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <GoalTypeBadge type={goal.type} />
            <GoalStatusBadge status={goal.status} />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{goal.name}</h1>
          {goal.description && (
            <p className="text-muted-foreground">{goal.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {goal.startDate && goal.endDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(goal.startDate), "MMM d, yyyy")} -{" "}
                  {format(new Date(goal.endDate), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {goal.ownerName && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{goal.ownerName}</span>
              </div>
            )}
            {goal.teamName && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{goal.teamName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-2xl font-bold">{goal.progress}%</span>
        </div>
        <GoalProgress progress={goal.progress} status={goal.status} size="lg" showLabel={false} />
      </div>
    </div>
  );
}
