"use client";

/**
 * Real-Time Chat Hook
 *
 * Client-side hook for managing Socket.io connection and chat state.
 * Handles connection, events, reconnection, and message management.
 *
 * @see PX-713 - Real-Time Chat
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

// ============================================
// TYPES
// ============================================

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  senderName?: string;
  content: string;
  timestamp: string;
  readAt?: string;
  moderation?: {
    flagged: boolean;
    severity: string;
  };
}

export interface TypingUser {
  userId: string;
  userName?: string;
  isTyping: boolean;
}

export interface OnlineUser {
  userId: string;
  userName?: string;
  online: boolean;
  lastSeen?: string;
}

export interface UseRealtimeChatOptions {
  token: string;
  userId: string;
  orgId: string;
  userType: "case_manager" | "client";
  userName?: string;
  clientId?: string; // Required for client users
  onMessage?: (message: ChatMessage) => void;
  onTyping?: (data: TypingUser) => void;
  onReadReceipt?: (data: { messageId: string; readAt: string; readBy: string }) => void;
  onPresenceChange?: (data: OnlineUser) => void;
  onModeration?: (data: { messageId: string; flags: string[]; severity: string }) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  autoConnect?: boolean;
}

export interface UseRealtimeChatReturn {
  // Connection state
  status: ConnectionStatus;
  isConnected: boolean;
  error: string | null;

  // Room state
  currentRoomId: string | null;
  messages: ChatMessage[];
  typingUsers: TypingUser[];
  onlineUsers: Map<string, OnlineUser>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string) => Promise<boolean>;
  leaveRoom: (roomId: string) => void;
  sendMessage: (roomId: string, content: string) => Promise<string | null>;
  setTyping: (roomId: string, isTyping: boolean) => void;
  markAsRead: (messageId: string) => void;
  clearMessages: () => void;
}

// ============================================
// HOOK
// ============================================

export function useRealtimeChat(options: UseRealtimeChatOptions): UseRealtimeChatReturn {
  const {
    token,
    userId,
    orgId,
    userType,
    userName,
    clientId,
    onMessage,
    onTyping,
    onReadReceipt,
    onPresenceChange,
    onModeration,
    onError,
    onConnectionChange,
    autoConnect = true,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Update connection status
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onConnectionChange?.(newStatus);
    },
    [onConnectionChange]
  );

  // Connect to socket server
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    updateStatus("connecting");
    setError(null);

    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    const socket = io(socketUrl, {
      path: "/api/socket",
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token,
        userId,
        orgId,
        userType,
        userName,
        clientId,
      },
    });

    // Connection events
    socket.on("connect", () => {
      console.log("[Chat] Connected");
      updateStatus("connected");
      setError(null);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Chat] Disconnected:", reason);
      updateStatus("disconnected");

      // Auto-reconnect for certain disconnect reasons
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        // Don't auto-reconnect for intentional disconnects
      } else {
        // Will auto-reconnect via socket.io
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[Chat] Connection error:", err);
      setError(err.message);
      updateStatus("error");
      onError?.(err);
    });

    // Chat events
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      onMessage?.(message);
    });

    socket.on("chat:typing", (data: TypingUser & { roomId: string }) => {
      // Don't show typing for self
      if (data.userId === userId) return;

      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== data.userId);
        if (data.isTyping) {
          return [...filtered, data];
        }
        return filtered;
      });

      // Auto-clear typing after 5 seconds
      const existingTimeout = typingTimeoutRef.current.get(data.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      if (data.isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
          typingTimeoutRef.current.delete(data.userId);
        }, 5000);
        typingTimeoutRef.current.set(data.userId, timeout);
      }

      onTyping?.(data);
    });

    socket.on("chat:read", (data: { messageId: string; readAt: string; readBy: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, readAt: data.readAt } : m
        )
      );
      onReadReceipt?.(data);
    });

    socket.on("presence:online", (data: OnlineUser) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data);
        return next;
      });
      onPresenceChange?.(data);
    });

    socket.on("chat:moderation", (data) => {
      onModeration?.(data);
    });

    socket.on("chat:error", (err: { code: string; message: string }) => {
      console.error("[Chat] Error:", err);
      setError(err.message);
      onError?.(new Error(err.message));
    });

    socketRef.current = socket;
  }, [
    token,
    userId,
    orgId,
    userType,
    userName,
    clientId,
    updateStatus,
    onMessage,
    onTyping,
    onReadReceipt,
    onPresenceChange,
    onModeration,
    onError,
  ]);

  // Disconnect from socket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear typing timeouts
    typingTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    typingTimeoutRef.current.clear();

    updateStatus("disconnected");
    setCurrentRoomId(null);
    setMessages([]);
    setTypingUsers([]);
  }, [updateStatus]);

  // Join a chat room
  const joinRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!socketRef.current?.connected) {
        setError("Not connected");
        return false;
      }

      return new Promise((resolve) => {
        socketRef.current!.emit(
          "chat:join",
          roomId,
          (response: { success: boolean; error?: string }) => {
            if (response.success) {
              setCurrentRoomId(roomId);
              resolve(true);
            } else {
              setError(response.error || "Failed to join room");
              resolve(false);
            }
          }
        );
      });
    },
    []
  );

  // Leave a chat room
  const leaveRoom = useCallback((roomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:leave", roomId);
    }
    if (currentRoomId === roomId) {
      setCurrentRoomId(null);
    }
  }, [currentRoomId]);

  // Send a message
  const sendMessage = useCallback(
    async (roomId: string, content: string): Promise<string | null> => {
      if (!socketRef.current?.connected) {
        setError("Not connected");
        return null;
      }

      return new Promise((resolve) => {
        socketRef.current!.emit(
          "chat:message",
          { roomId, content },
          (response: { success: boolean; messageId?: string; error?: string }) => {
            if (response.success && response.messageId) {
              resolve(response.messageId);
            } else {
              setError(response.error || "Failed to send message");
              resolve(null);
            }
          }
        );
      });
    },
    []
  );

  // Set typing indicator
  const setTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:typing", { roomId, isTyping });
    }
  }, []);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:read", messageId);
    }
  }, []);

  // Clear local messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && token && userId && orgId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, userId, orgId, connect, disconnect]);

  return {
    // Connection state
    status,
    isConnected: status === "connected",
    error,

    // Room state
    currentRoomId,
    messages,
    typingUsers,
    onlineUsers,

    // Actions
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    setTyping,
    markAsRead,
    clearMessages,
  };
}
