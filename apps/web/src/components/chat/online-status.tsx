"use client";

/**
 * OnlineStatus - Shows online/offline badge
 *
 * @see PX-713 - Real-Time Chat
 */

import { cn } from "@/lib/utils";

interface OnlineStatusProps {
  online: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OnlineStatus({
  online,
  showLabel = true,
  size = "md",
  className,
}: OnlineStatusProps) {
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "rounded-full",
          sizeClasses[size],
          online ? "bg-green-500" : "bg-gray-400",
          online && "animate-pulse"
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn(
            textSizeClasses[size],
            online ? "text-green-700" : "text-gray-500"
          )}
        >
          {online ? "Online" : "Offline"}
        </span>
      )}
    </div>
  );
}
