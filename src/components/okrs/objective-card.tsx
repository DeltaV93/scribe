"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ObjectiveStatusBadge } from "./objective-status-badge";
import { OKRProgress } from "./okr-progress";
import { ObjectiveStatus } from "@prisma/client";
import { format } from "date-fns";
import { Calendar, User, Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObjectiveCardProps {
  objective: {
    id: string;
    title: string;
    description: string | null;
    status: ObjectiveStatus;
    progress: number;
    startDate: string | null;
    endDate: string | null;
    ownerName: string | null;
    ownerEmail: string;
    keyResults: Array<{
      id: string;
      title: string;
      progressPercentage: number;
    }>;
    childCount: number;
  };
  onClick?: () => void;
  className?: string;
}

export function ObjectiveCard({
  objective,
  onClick,
  className,
}: ObjectiveCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium line-clamp-2">
            {objective.title}
          </CardTitle>
          <ObjectiveStatusBadge status={objective.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <OKRProgress value={objective.progress} size="md" />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{objective.ownerName || objective.ownerEmail}</span>
        </div>

        {objective.keyResults.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>
              {objective.keyResults.length} key result
              {objective.keyResults.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {(objective.startDate || objective.endDate) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {objective.startDate && format(new Date(objective.startDate), "MMM d")}
              {objective.startDate && objective.endDate && " - "}
              {objective.endDate && format(new Date(objective.endDate), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {objective.childCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
            <span>
              {objective.childCount} child objective
              {objective.childCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {objective.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {objective.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
