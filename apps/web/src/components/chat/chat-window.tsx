"use client";

/**
 * ChatWindow - Main chat interface
 *
 * @see PX-713 - Real-Time Chat
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { OnlineStatus } from "./online-status";
import { BusinessHoursNotice } from "./business-hours-notice";
import {
  useRealtimeChat,
  type ChatMessage as ChatMessageType,
} from "@/hooks/use-realtime-chat";

interface ChatWindowProps {
  roomId: string;
  clientId: string;
  clientName: string;
  token: string;
  userId: string;
  orgId: string;
  userType: "case_manager" | "client";
  userName?: string;
  assignedCaseManagerName?: string;
  isOnline?: boolean;
  businessHours?: {
    isWithinHours: boolean;
    message: string;
    nextAvailableTime?: string;
  };
  onClose?: () => void;
  className?: string;
}

export function ChatWindow({
  roomId,
  clientId,
  clientName,
  token,
  userId,
  orgId,
  userType,
  userName,
  assignedCaseManagerName,
  isOnline = false,
  businessHours,
  onClose,
  className,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    status,
    isConnected,
    error,
    messages,
    typingUsers,
    connect,
    joinRoom,
    leaveRoom,
    sendMessage,
    setTyping,
    markAsRead,
    clearMessages,
  } = useRealtimeChat({
    token,
    userId,
    orgId,
    userType,
    userName,
    clientId: userType === "client" ? clientId : undefined,
    onMessage: (message) => {
      // Auto-mark as read if the message is from the other party
      const isFromOther =
        (userType === "case_manager" && message.senderType === "CLIENT") ||
        (userType === "client" && message.senderType === "CASE_MANAGER");
      if (isFromOther) {
        markAsRead(message.id);
      }
    },
  });

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load message history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(
          `/api/chat/rooms/${roomId}/messages?limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          // Messages from API come in chronological order
          // useRealtimeChat will receive new messages via socket
          // We could set initial messages here if needed
        }
      } catch (err) {
        console.error("Failed to load message history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [roomId]);

  // Join room when connected
  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId);
    }

    return () => {
      if (roomId) {
        leaveRoom(roomId);
      }
    };
  }, [isConnected, roomId, joinRoom, leaveRoom]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Send typing indicator
    if (value.length > 0) {
      setTyping(roomId, true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(roomId, false);
      }, 2000);
    } else {
      setTyping(roomId, false);
    }
  };

  // Handle send message
  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setTyping(roomId, false);

    try {
      const messageId = await sendMessage(roomId, content);
      if (messageId) {
        setInputValue("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get the first typing user to display
  const typingUser = typingUsers[0];

  // Determine if we should show business hours notice
  const showBusinessHoursNotice =
    businessHours && !businessHours.isWithinHours && userType === "client";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border bg-background shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {clientName[0]?.toUpperCase() || "C"}
          </div>
          <div>
            <h3 className="font-medium">{clientName}</h3>
            <div className="flex items-center gap-2">
              <OnlineStatus online={isOnline} size="sm" />
              {assignedCaseManagerName && userType === "client" && (
                <span className="text-xs text-muted-foreground">
                  CM: {assignedCaseManagerName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          {status === "connecting" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {status === "error" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={connect}
              title="Reconnect"
            >
              <RefreshCw className="h-4 w-4 text-destructive" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Business hours notice */}
      {showBusinessHoursNotice && (
        <div className="p-3">
          <BusinessHoursNotice
            message={businessHours.message}
            nextAvailableTime={businessHours.nextAvailableTime}
          />
        </div>
      )}

      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p>No messages yet.</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                id={message.id}
                content={message.content}
                senderName={message.senderName}
                senderType={message.senderType}
                timestamp={message.timestamp}
                readAt={message.readAt}
                isOwnMessage={message.senderId === userId}
                moderation={message.moderation}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Typing indicator */}
      {typingUser && (
        <div className="px-4 py-2">
          <TypingIndicator userName={typingUser.userName} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!isConnected || isSending}
              className={cn(
                "w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[40px] max-h-[120px]"
              )}
              rows={1}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected || isSending}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
