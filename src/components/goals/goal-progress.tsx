"use client";

import { cn } from "@/lib/utils";
import { GoalStatus } from "@prisma/client";

interface GoalProgressProps {
  progress: number;
  status?: GoalStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function GoalProgress({
  progress,
  status,
  size = "md",
  showLabel = true,
  className,
}: GoalProgressProps) {
  const getProgressColor = () => {
    if (status === GoalStatus.COMPLETED) return "bg-emerald-500";
    if (status === GoalStatus.AT_RISK) return "bg-yellow-500";
    if (status === GoalStatus.BEHIND) return "bg-red-500";
    if (progress >= 75) return "bg-green-500";
    if (progress >= 50) return "bg-blue-500";
    if (progress >= 25) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-gray-100",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            getProgressColor()
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress}% complete</span>
        </div>
      )}
    </div>
  );
}
