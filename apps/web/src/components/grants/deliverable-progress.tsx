"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DeliverableProgressProps {
  currentValue: number;
  targetValue: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function DeliverableProgress({
  currentValue,
  targetValue,
  className,
  showLabel = true,
  size = "md",
}: DeliverableProgressProps) {
  const percentage = targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0;

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 75) return "bg-blue-500";
    if (pct >= 50) return "bg-yellow-500";
    if (pct >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative">
        <Progress
          value={percentage}
          className={cn(sizeClasses[size], "[&>div]:transition-all")}
        />
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            sizeClasses[size],
            "[&]:bg-transparent"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              getProgressColor(percentage)
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{currentValue.toLocaleString()} / {targetValue.toLocaleString()}</span>
          <span>{percentage}%</span>
        </div>
      )}
    </div>
  );
}
