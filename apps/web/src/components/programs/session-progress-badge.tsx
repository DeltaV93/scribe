"use client";

/**
 * Session Progress Badge (PX-726)
 * Compact display of session completion progress (e.g., "3/8")
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionProgressBadgeProps {
  completedSessions: number;
  totalSessions: number;
  className?: string;
  showIcon?: boolean;
}

export function SessionProgressBadge({
  completedSessions,
  totalSessions,
  className,
  showIcon = false,
}: SessionProgressBadgeProps) {
  // Calculate percentage for color coding
  const percentage = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  // Determine variant based on progress
  let variant: "default" | "secondary" | "outline" = "secondary";
  let colorClass = "";

  if (percentage === 100) {
    variant = "default";
    colorClass = "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  } else if (percentage >= 75) {
    colorClass = "bg-green-100 text-green-700 hover:bg-green-100";
  } else if (percentage >= 50) {
    colorClass = "bg-blue-100 text-blue-700 hover:bg-blue-100";
  } else if (percentage >= 25) {
    colorClass = "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }

  const tooltipText =
    percentage === 100
      ? "All sessions completed"
      : `${completedSessions} of ${totalSessions} sessions completed (${Math.round(percentage)}%)`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={cn(
              "font-mono text-xs cursor-default",
              colorClass,
              className
            )}
          >
            {showIcon && percentage === 100 && (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            )}
            {completedSessions}/{totalSessions}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
