"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoalProgress } from "./goal-progress";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkedItemCardProps {
  type: "grant" | "objective" | "kpi";
  item: {
    id: string;
    name: string;
    status: string;
    progress: number;
    weight?: number;
  };
  onUnlink?: () => void;
  onView?: () => void;
  className?: string;
}

const typeLabels = {
  grant: "Grant",
  objective: "OKR",
  kpi: "KPI",
};

const typeColors = {
  grant: "bg-purple-100 text-purple-700",
  objective: "bg-indigo-100 text-indigo-700",
  kpi: "bg-blue-100 text-blue-700",
};

export function LinkedItemCard({
  type,
  item,
  onUnlink,
  onView,
  className,
}: LinkedItemCardProps) {
  return (
    <Card className={cn("group", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className={cn("text-xs", typeColors[type])}>
                {typeLabels[type]}
              </Badge>
              {item.weight && item.weight !== 1 && (
                <Badge variant="outline" className="text-xs">
                  Weight: {item.weight}x
                </Badge>
              )}
            </div>
            <h4 className="font-medium truncate">{item.name}</h4>
            <div className="mt-2">
              <GoalProgress progress={item.progress} size="sm" showLabel />
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onView && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onView}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {onUnlink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onUnlink}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
