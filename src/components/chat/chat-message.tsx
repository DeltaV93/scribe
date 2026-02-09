"use client";

/**
 * ChatMessage - Individual message display
 *
 * @see PX-713 - Real-Time Chat
 */

import { formatDistanceToNow, format } from "date-fns";
import { Check, CheckCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  id: string;
  content: string;
  senderName?: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  timestamp: string;
  readAt?: string;
  isOwnMessage: boolean;
  moderation?: {
    flagged: boolean;
    severity: string;
  };
  className?: string;
}

export function ChatMessage({
  id,
  content,
  senderName,
  senderType,
  timestamp,
  readAt,
  isOwnMessage,
  moderation,
  className,
}: ChatMessageProps) {
  const messageDate = new Date(timestamp);
  const isToday = new Date().toDateString() === messageDate.toDateString();
  const timeDisplay = isToday
    ? format(messageDate, "h:mm a")
    : formatDistanceToNow(messageDate, { addSuffix: true });

  const isFlagged = moderation?.flagged && moderation.severity !== "none";
  const isCritical = moderation?.severity === "critical";

  return (
    <div
      className={cn(
        "group flex gap-3",
        isOwnMessage ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar placeholder */}
      <div
        className={cn(
          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white",
          isOwnMessage ? "bg-primary" : "bg-gray-500"
        )}
      >
        {senderName?.[0]?.toUpperCase() || (senderType === "CLIENT" ? "C" : "CM")}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "flex max-w-[70%] flex-col",
          isOwnMessage ? "items-end" : "items-start"
        )}
      >
        {/* Sender name for received messages */}
        {!isOwnMessage && senderName && (
          <span className="mb-1 text-xs text-muted-foreground">{senderName}</span>
        )}

        {/* Message content */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 shadow-sm",
            isOwnMessage
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm",
            isFlagged && "border-2 border-yellow-400",
            isCritical && "border-2 border-red-500"
          )}
        >
          {isCritical && (
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Crisis indicator detected</span>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
        </div>

        {/* Timestamp and read receipt */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span title={format(messageDate, "PPpp")}>{timeDisplay}</span>
          {isOwnMessage && (
            <span className="flex items-center">
              {readAt ? (
                <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
