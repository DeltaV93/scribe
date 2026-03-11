"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OKRProgressProps {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OKRProgress({
  value,
  showLabel = true,
  size = "md",
  className,
}: OKRProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const getColorClass = (progress: number) => {
    if (progress >= 100) return "bg-green-500";
    if (progress >= 70) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={cn("relative w-full overflow-hidden rounded-full bg-secondary", sizeClasses[size])}>
        <div
          className={cn(
            "h-full transition-all duration-300",
            getColorClass(clampedValue)
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
