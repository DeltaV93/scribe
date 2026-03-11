"use client";

/**
 * TypingIndicator - Shows when other party is typing
 *
 * @see PX-713 - Real-Time Chat
 */

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  userName?: string;
  className?: string;
}

export function TypingIndicator({ userName, className }: TypingIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex space-x-1">
        <span
          className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span>{userName ? `${userName} is typing...` : "Typing..."}</span>
    </div>
  );
}
