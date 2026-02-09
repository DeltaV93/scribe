/**
 * Socket.io Server Integration
 *
 * Real-time WebSocket server for chat functionality.
 * Uses Redis adapter for multi-server scaling.
 *
 * @see PX-713 - Real-Time Chat
 */

import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { prisma } from "@/lib/db";
import {
  moderateContent,
  type ModerationResult,
} from "@/lib/services/content-moderation";

// ============================================
// TYPES
// ============================================

export interface ServerToClientEvents {
  "chat:message": (message: ChatMessageDTO) => void;
  "chat:typing": (data: TypingIndicatorDTO) => void;
  "chat:read": (data: ReadReceiptDTO) => void;
  "presence:online": (data: PresenceDTO) => void;
  "chat:error": (error: { code: string; message: string }) => void;
  "chat:moderation": (data: ModerationAlertDTO) => void;
}

export interface ClientToServerEvents {
  "chat:join": (roomId: string, callback?: (response: JoinResponse) => void) => void;
  "chat:leave": (roomId: string) => void;
  "chat:message": (
    data: SendMessageDTO,
    callback?: (response: MessageResponse) => void
  ) => void;
  "chat:typing": (data: TypingDTO) => void;
  "chat:read": (messageId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  orgId: string;
  userType: "case_manager" | "client";
  clientId?: string; // For client connections
  userName?: string;
}

export interface ChatMessageDTO {
  id: string;
  roomId: string;
  senderId: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  senderName?: string;
  content: string;
  timestamp: string;
  moderation?: {
    flagged: boolean;
    severity: string;
  };
}

export interface TypingIndicatorDTO {
  roomId: string;
  userId: string;
  userName?: string;
  isTyping: boolean;
}

export interface ReadReceiptDTO {
  messageId: string;
  readAt: string;
  readBy: string;
}

export interface PresenceDTO {
  userId: string;
  userName?: string;
  online: boolean;
  lastSeen?: string;
}

export interface ModerationAlertDTO {
  messageId: string;
  flags: string[];
  severity: string;
  requiresReview: boolean;
}

interface SendMessageDTO {
  roomId: string;
  content: string;
}

interface TypingDTO {
  roomId: string;
  isTyping: boolean;
}

interface JoinResponse {
  success: boolean;
  error?: string;
}

interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// SOCKET.IO SERVER SINGLETON
// ============================================

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> | null = null;

// Track online users per org for presence
const onlineUsers = new Map<string, Set<string>>(); // orgId -> Set<userId>

/**
 * Initialize Socket.io server with Redis adapter
 */
export function initSocketServer(httpServer: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/api/socket",
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Set up Redis adapter for multi-server scaling
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        lazyConnect: true,
      });
      const subClient = pubClient.duplicate();

      // Connect both clients
      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          if (io) {
            io.adapter(createAdapter(pubClient, subClient));
            console.log("[Socket.io] Redis adapter configured");
          }
        })
        .catch((err) => {
          console.error("[Socket.io] Redis adapter connection failed:", err);
        });
    } catch (error) {
      console.warn(
        "[Socket.io] Redis not available, running without adapter:",
        error
      );
    }
  } else {
    console.warn(
      "[Socket.io] REDIS_URL not set, running without Redis adapter"
    );
  }

  // Set up authentication middleware
  io.use(authMiddleware);

  // Set up connection handlers
  io.on("connection", handleConnection);

  console.log("[Socket.io] Server initialized");

  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): Server | null {
  return io;
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

async function authMiddleware(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth.token;
    const userType = socket.handshake.auth.userType as "case_manager" | "client";

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (userType === "case_manager") {
      // Validate case manager session token (JWT from Supabase)
      // For now, we'll trust the token and extract user info from it
      // In production, validate the token with Supabase
      const userId = socket.handshake.auth.userId;
      const orgId = socket.handshake.auth.orgId;
      const userName = socket.handshake.auth.userName;

      if (!userId || !orgId) {
        return next(new Error("Invalid authentication data"));
      }

      // Verify user exists and is active
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          orgId: orgId,
          isActive: true,
        },
        select: { id: true, name: true, orgId: true },
      });

      if (!user) {
        return next(new Error("User not found or inactive"));
      }

      socket.data.userId = user.id;
      socket.data.orgId = user.orgId;
      socket.data.userType = "case_manager";
      socket.data.userName = user.name || undefined;
    } else if (userType === "client") {
      // Validate client portal session token
      const sessionToken = token;
      const clientId = socket.handshake.auth.clientId;

      if (!clientId) {
        return next(new Error("Client ID required"));
      }

      // Verify portal session is valid
      const session = await prisma.portalSession.findFirst({
        where: {
          sessionToken: sessionToken,
          clientId: clientId,
          expiresAt: { gt: new Date() },
        },
        include: {
          client: {
            select: {
              id: true,
              orgId: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!session) {
        return next(new Error("Invalid or expired session"));
      }

      socket.data.userId = session.clientId;
      socket.data.orgId = session.client.orgId;
      socket.data.userType = "client";
      socket.data.clientId = session.clientId;
      socket.data.userName = `${session.client.firstName} ${session.client.lastName}`;
    } else {
      return next(new Error("Invalid user type"));
    }

    next();
  } catch (error) {
    console.error("[Socket.io] Auth middleware error:", error);
    next(new Error("Authentication failed"));
  }
}

// ============================================
// CONNECTION HANDLERS
// ============================================

function handleConnection(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  console.log(
    `[Socket.io] User connected: ${socket.data.userId} (${socket.data.userType})`
  );

  // Track online status
  trackUserOnline(socket.data.orgId, socket.data.userId, true);

  // Broadcast presence to org
  broadcastPresence(socket.data.orgId, socket.data.userId, true, socket.data.userName);

  // Set up event handlers
  socket.on("chat:join", (roomId, callback) =>
    handleJoinRoom(socket, roomId, callback)
  );
  socket.on("chat:leave", (roomId) => handleLeaveRoom(socket, roomId));
  socket.on("chat:message", (data, callback) =>
    handleMessage(socket, data, callback)
  );
  socket.on("chat:typing", (data) => handleTyping(socket, data));
  socket.on("chat:read", (messageId) => handleReadReceipt(socket, messageId));

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(
      `[Socket.io] User disconnected: ${socket.data.userId} (${socket.data.userType})`
    );
    trackUserOnline(socket.data.orgId, socket.data.userId, false);
    broadcastPresence(socket.data.orgId, socket.data.userId, false);
  });
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleJoinRoom(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomId: string,
  callback?: (response: JoinResponse) => void
) {
  try {
    // Verify user has access to this room
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        organizationId: socket.data.orgId,
        isActive: true,
      },
      include: {
        client: {
          select: {
            id: true,
            assignedTo: true,
          },
        },
      },
    });

    if (!room) {
      socket.emit("chat:error", {
        code: "ROOM_NOT_FOUND",
        message: "Chat room not found",
      });
      callback?.({ success: false, error: "Room not found" });
      return;
    }

    // Check authorization
    if (socket.data.userType === "client") {
      // Clients can only join their own room
      if (room.clientId !== socket.data.clientId) {
        callback?.({ success: false, error: "Unauthorized" });
        return;
      }
    } else {
      // Case managers can join rooms for clients in their org
      // Additional check: verify they're assigned or have permission
      // For now, any case manager in the org can access
    }

    // Join the socket room
    await socket.join(roomId);
    console.log(`[Socket.io] ${socket.data.userId} joined room ${roomId}`);

    // Update room activity
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastActivityAt: new Date() },
    });

    callback?.({ success: true });
  } catch (error) {
    console.error("[Socket.io] Error joining room:", error);
    callback?.({ success: false, error: "Failed to join room" });
  }
}

function handleLeaveRoom(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  roomId: string
) {
  socket.leave(roomId);
  console.log(`[Socket.io] ${socket.data.userId} left room ${roomId}`);
}

async function handleMessage(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: SendMessageDTO,
  callback?: (response: MessageResponse) => void
) {
  try {
    const { roomId, content } = data;

    if (!content || content.trim().length === 0) {
      callback?.({ success: false, error: "Message cannot be empty" });
      return;
    }

    if (content.length > 10000) {
      callback?.({ success: false, error: "Message too long" });
      return;
    }

    // Verify room access
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        organizationId: socket.data.orgId,
        isActive: true,
      },
    });

    if (!room) {
      callback?.({ success: false, error: "Room not found" });
      return;
    }

    // Run content moderation
    const moderationResult = await moderateContent(content);

    // Create message in database using the existing Message model
    const senderType =
      socket.data.userType === "case_manager" ? "CASE_MANAGER" : "CLIENT";

    const message = await prisma.message.create({
      data: {
        orgId: socket.data.orgId,
        clientId: room.clientId,
        senderId: socket.data.userType === "case_manager" ? socket.data.userId : null,
        senderType: senderType,
        content: content,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    // Update room activity
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastActivityAt: new Date() },
    });

    // Prepare message DTO for broadcast
    const messageDTO: ChatMessageDTO = {
      id: message.id,
      roomId: roomId,
      senderId: socket.data.userId,
      senderType: senderType,
      senderName: socket.data.userName,
      content: content,
      timestamp: message.sentAt.toISOString(),
      moderation: moderationResult.flags.length > 0
        ? {
            flagged: true,
            severity: moderationResult.severity,
          }
        : undefined,
    };

    // Broadcast message to all users in the room
    io?.to(roomId).emit("chat:message", messageDTO);

    // If moderation flagged critical content, notify supervisors
    if (moderationResult.reviewRequired) {
      const moderationAlert: ModerationAlertDTO = {
        messageId: message.id,
        flags: moderationResult.flags.map((f) => f.type),
        severity: moderationResult.severity,
        requiresReview: true,
      };

      // Emit to org-level room for supervisors
      io?.to(`org:${socket.data.orgId}:supervisors`).emit(
        "chat:moderation",
        moderationAlert
      );

      // Log the moderation event for audit
      console.log(
        `[Socket.io] Moderation alert for message ${message.id}: ${moderationResult.severity}`
      );
    }

    callback?.({ success: true, messageId: message.id });
  } catch (error) {
    console.error("[Socket.io] Error sending message:", error);
    callback?.({ success: false, error: "Failed to send message" });
  }
}

function handleTyping(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: TypingDTO
) {
  const { roomId, isTyping } = data;

  // Broadcast typing indicator to room (except sender)
  socket.to(roomId).emit("chat:typing", {
    roomId,
    userId: socket.data.userId,
    userName: socket.data.userName,
    isTyping,
  });
}

async function handleReadReceipt(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  messageId: string
) {
  try {
    // Update message as read
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        readAt: new Date(),
        status: "READ",
      },
      select: {
        id: true,
        clientId: true,
      },
    });

    // Find the room for this message
    const room = await prisma.chatRoom.findFirst({
      where: {
        clientId: message.clientId,
        organizationId: socket.data.orgId,
      },
    });

    if (room) {
      // Broadcast read receipt to the room
      io?.to(room.id).emit("chat:read", {
        messageId,
        readAt: new Date().toISOString(),
        readBy: socket.data.userId,
      });
    }
  } catch (error) {
    console.error("[Socket.io] Error updating read receipt:", error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function trackUserOnline(orgId: string, userId: string, online: boolean) {
  if (!onlineUsers.has(orgId)) {
    onlineUsers.set(orgId, new Set());
  }

  const orgUsers = onlineUsers.get(orgId)!;
  if (online) {
    orgUsers.add(userId);
  } else {
    orgUsers.delete(userId);
  }
}

function broadcastPresence(
  orgId: string,
  userId: string,
  online: boolean,
  userName?: string
) {
  if (!io) return;

  // Broadcast to org room
  io.to(`org:${orgId}`).emit("presence:online", {
    userId,
    userName,
    online,
    lastSeen: online ? undefined : new Date().toISOString(),
  });
}

/**
 * Get online users for an organization
 */
export function getOnlineUsersForOrg(orgId: string): string[] {
  return Array.from(onlineUsers.get(orgId) || []);
}

/**
 * Check if a specific user is online
 */
export function isUserOnline(orgId: string, userId: string): boolean {
  return onlineUsers.get(orgId)?.has(userId) || false;
}

/**
 * Send a message to a specific room from server-side code
 */
export function sendToRoom(roomId: string, event: string, data: unknown) {
  if (!io) {
    console.warn("[Socket.io] Server not initialized, cannot send to room");
    return;
  }
  io.to(roomId).emit(event as keyof ServerToClientEvents, data as never);
}

/**
 * Join a user to an org-level room (for broadcast notifications)
 */
export async function joinOrgRoom(socketId: string, orgId: string) {
  if (!io) return;
  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    await socket.join(`org:${orgId}`);
  }
}
