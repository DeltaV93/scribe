"use client";

import { MessageItem } from "./message-item";

interface Message {
  id: string;
  content: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  status: string;
  sentAt: string;
  sender?: {
    name: string | null;
    email: string;
  } | null;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    fileSize: number;
  }[];
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No messages yet
      </div>
    );
  }

  // Sort messages by date, oldest first (for chat-like display)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedMessages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
