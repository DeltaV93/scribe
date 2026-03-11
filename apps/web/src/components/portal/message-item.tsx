"use client";

import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Paperclip } from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

interface MessageItemProps {
  message: {
    id: string;
    content: string;
    senderType: "CASE_MANAGER" | "CLIENT";
    status: string;
    sentAt: string;
    sender?: {
      name: string | null;
      email: string;
    } | null;
    attachments?: Attachment[];
  };
}

export function MessageItem({ message }: MessageItemProps) {
  const isFromCaseManager = message.senderType === "CASE_MANAGER";
  const senderName = isFromCaseManager
    ? message.sender?.name || "Your Case Manager"
    : "You";

  return (
    <div
      className={cn(
        "max-w-[85%] p-3 rounded-2xl",
        isFromCaseManager
          ? "bg-muted mr-auto rounded-bl-sm"
          : "bg-primary text-primary-foreground ml-auto rounded-br-sm"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-4 mb-1",
          isFromCaseManager ? "" : "flex-row-reverse"
        )}
      >
        <span className="text-xs font-medium opacity-80">{senderName}</span>
        <span className="text-xs opacity-60">
          {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true })}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

      {message.attachments && message.attachments.length > 0 && (
        <div className={cn("mt-2 space-y-1", isFromCaseManager ? "" : "opacity-80")}>
          {message.attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1 text-xs"
            >
              <Paperclip className="h-3 w-3" />
              <span className="truncate">{att.filename}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
