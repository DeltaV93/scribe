/**
 * Real-Time Chat Service
 *
 * Business logic for real-time chat functionality including
 * room management, message persistence, and business hours checking.
 *
 * @see PX-713 - Real-Time Chat
 */

import { prisma } from "@/lib/db";
import { moderateContent } from "./content-moderation";
import { getOnlineUsersForOrg, isUserOnline, sendToRoom } from "@/lib/realtime/socket-server";
import type { ChatMessageDTO } from "@/lib/realtime/socket-server";

// ============================================
// TYPES
// ============================================

export interface ChatRoom {
  id: string;
  organizationId: string;
  clientId: string;
  isActive: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    assignedTo: string;
  };
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderType: "CASE_MANAGER" | "CLIENT";
  senderName?: string;
  content: string;
  timestamp: Date;
  readAt?: Date;
  moderation?: {
    flagged: boolean;
    severity: string;
    flags: string[];
  };
}

export interface BusinessHoursConfig {
  start: string; // "09:00"
  end: string; // "17:00"
  timezone: string; // "America/New_York"
  days: number[]; // [1,2,3,4,5] for Mon-Fri
}

export interface BusinessHoursStatus {
  isWithinHours: boolean;
  nextAvailableTime?: string;
  timezone: string;
  message: string;
}

// ============================================
// ROOM MANAGEMENT
// ============================================

/**
 * Get or create a chat room for a client
 */
export async function getOrCreateRoom(
  orgId: string,
  clientId: string
): Promise<ChatRoom> {
  // Try to find existing room
  const existingRoom = await prisma.chatRoom.findFirst({
    where: {
      organizationId: orgId,
      clientId: clientId,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTo: true,
        },
      },
    },
  });

  if (existingRoom) {
    // Reactivate if inactive
    if (!existingRoom.isActive) {
      await prisma.chatRoom.update({
        where: { id: existingRoom.id },
        data: { isActive: true, lastActivityAt: new Date() },
      });
    }
    return existingRoom;
  }

  // Create new room
  const newRoom = await prisma.chatRoom.create({
    data: {
      organizationId: orgId,
      clientId: clientId,
      isActive: true,
      lastActivityAt: new Date(),
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTo: true,
        },
      },
    },
  });

  return newRoom;
}

/**
 * Get chat room by ID
 */
export async function getRoomById(
  roomId: string,
  orgId: string
): Promise<ChatRoom | null> {
  return prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTo: true,
        },
      },
    },
  });
}

/**
 * Get all active chat rooms for an organization
 */
export async function getActiveRooms(
  orgId: string,
  options?: {
    assignedTo?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<{ rooms: ChatRoom[]; nextCursor?: string }> {
  const { assignedTo, limit = 50, cursor } = options || {};

  const rooms = await prisma.chatRoom.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      ...(assignedTo && {
        client: {
          assignedTo: assignedTo,
        },
      }),
      ...(cursor && {
        lastActivityAt: {
          lt: new Date(cursor),
        },
      }),
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTo: true,
        },
      },
    },
    orderBy: {
      lastActivityAt: "desc",
    },
    take: limit + 1,
  });

  const hasMore = rooms.length > limit;
  const resultRooms = hasMore ? rooms.slice(0, limit) : rooms;
  const nextCursor = hasMore
    ? resultRooms[resultRooms.length - 1].lastActivityAt.toISOString()
    : undefined;

  return { rooms: resultRooms, nextCursor };
}

/**
 * Deactivate a chat room
 */
export async function deactivateRoom(
  roomId: string,
  orgId: string
): Promise<void> {
  await prisma.chatRoom.updateMany({
    where: {
      id: roomId,
      organizationId: orgId,
    },
    data: {
      isActive: false,
    },
  });
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

/**
 * Send a message in a chat room (REST fallback)
 */
export async function sendMessage(
  roomId: string,
  orgId: string,
  senderId: string,
  senderType: "CASE_MANAGER" | "CLIENT",
  content: string
): Promise<ChatMessage> {
  // Get room and validate
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
      isActive: true,
    },
  });

  if (!room) {
    throw new Error("Room not found or inactive");
  }

  // Validate content
  if (!content || content.trim().length === 0) {
    throw new Error("Message cannot be empty");
  }

  if (content.length > 10000) {
    throw new Error("Message too long");
  }

  // Run content moderation
  const moderationResult = await moderateContent(content);

  // Create message
  const message = await prisma.message.create({
    data: {
      orgId: orgId,
      clientId: room.clientId,
      senderId: senderType === "CASE_MANAGER" ? senderId : null,
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

  // Get sender name for DTO
  let senderName: string | undefined;
  if (senderType === "CASE_MANAGER") {
    const user = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });
    senderName = user?.name || undefined;
  } else {
    const client = await prisma.client.findUnique({
      where: { id: room.clientId },
      select: { firstName: true, lastName: true },
    });
    senderName = client ? `${client.firstName} ${client.lastName}` : undefined;
  }

  // Broadcast via Socket.io if available
  const messageDTO: ChatMessageDTO = {
    id: message.id,
    roomId: roomId,
    senderId: senderId,
    senderType: senderType,
    senderName: senderName,
    content: content,
    timestamp: message.sentAt.toISOString(),
    moderation: moderationResult.flags.length > 0
      ? {
          flagged: true,
          severity: moderationResult.severity,
        }
      : undefined,
  };

  sendToRoom(roomId, "chat:message", messageDTO);

  return {
    id: message.id,
    roomId: roomId,
    senderId: senderId,
    senderType: senderType,
    senderName: senderName,
    content: content,
    timestamp: message.sentAt,
    moderation: moderationResult.flags.length > 0
      ? {
          flagged: true,
          severity: moderationResult.severity,
          flags: moderationResult.flags.map((f) => f.type),
        }
      : undefined,
  };
}

/**
 * Get message history for a room
 */
export async function getMessageHistory(
  roomId: string,
  orgId: string,
  options?: {
    limit?: number;
    before?: string;
    after?: string;
  }
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const { limit = 50, before, after } = options || {};

  // Get room to find client ID
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
    },
  });

  if (!room) {
    throw new Error("Room not found");
  }

  // Fetch messages for this client
  const messages = await prisma.message.findMany({
    where: {
      clientId: room.clientId,
      orgId: orgId,
      deletedAt: null,
      ...(before && { sentAt: { lt: new Date(before) } }),
      ...(after && { sentAt: { gt: new Date(after) } }),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      sentAt: "desc",
    },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  // Get client name for client messages
  const client = await prisma.client.findUnique({
    where: { id: room.clientId },
    select: { firstName: true, lastName: true },
  });
  const clientName = client ? `${client.firstName} ${client.lastName}` : undefined;

  // Map to ChatMessage type
  const chatMessages: ChatMessage[] = resultMessages
    .map((m) => ({
      id: m.id,
      roomId: roomId,
      senderId: m.senderId || room.clientId,
      senderType: m.senderType as "CASE_MANAGER" | "CLIENT",
      senderName: m.senderType === "CASE_MANAGER" ? m.sender?.name || undefined : clientName,
      content: m.content,
      timestamp: m.sentAt,
      readAt: m.readAt || undefined,
    }))
    .reverse(); // Reverse to get chronological order

  return { messages: chatMessages, hasMore };
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
  roomId: string,
  orgId: string,
  readerId: string,
  readerType: "CASE_MANAGER" | "CLIENT"
): Promise<number> {
  // Get room
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
    },
  });

  if (!room) {
    throw new Error("Room not found");
  }

  // Mark unread messages from the other party as read
  const oppositeType = readerType === "CASE_MANAGER" ? "CLIENT" : "CASE_MANAGER";

  const result = await prisma.message.updateMany({
    where: {
      clientId: room.clientId,
      orgId: orgId,
      senderType: oppositeType,
      readAt: null,
    },
    data: {
      readAt: new Date(),
      status: "READ",
    },
  });

  return result.count;
}

/**
 * Get unread message count for a room
 */
export async function getUnreadCount(
  roomId: string,
  orgId: string,
  viewerType: "CASE_MANAGER" | "CLIENT"
): Promise<number> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
    },
  });

  if (!room) {
    return 0;
  }

  const oppositeType = viewerType === "CASE_MANAGER" ? "CLIENT" : "CASE_MANAGER";

  return prisma.message.count({
    where: {
      clientId: room.clientId,
      orgId: orgId,
      senderType: oppositeType,
      readAt: null,
    },
  });
}

// ============================================
// BUSINESS HOURS
// ============================================

/**
 * Check if current time is within organization business hours
 */
export async function isWithinBusinessHours(
  orgId: string
): Promise<BusinessHoursStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      realTimeChatEnabled: true,
      businessHoursStart: true,
      businessHoursEnd: true,
      businessHoursTimezone: true,
      businessHoursDays: true,
    },
  });

  if (!org) {
    return {
      isWithinHours: false,
      timezone: "UTC",
      message: "Organization not found",
    };
  }

  // If chat is disabled, return immediately
  if (!org.realTimeChatEnabled) {
    return {
      isWithinHours: false,
      timezone: org.businessHoursTimezone || "UTC",
      message: "Real-time chat is not enabled for this organization",
    };
  }

  // If no business hours configured, assume always available
  if (!org.businessHoursStart || !org.businessHoursEnd || !org.businessHoursTimezone) {
    return {
      isWithinHours: true,
      timezone: org.businessHoursTimezone || "UTC",
      message: "Chat is available",
    };
  }

  const config: BusinessHoursConfig = {
    start: org.businessHoursStart,
    end: org.businessHoursEnd,
    timezone: org.businessHoursTimezone,
    days: org.businessHoursDays || [1, 2, 3, 4, 5],
  };

  return checkBusinessHours(config);
}

/**
 * Check if current time falls within business hours
 */
function checkBusinessHours(config: BusinessHoursConfig): BusinessHoursStatus {
  const { start, end, timezone, days } = config;

  // Get current time in the org's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour");
  const minutePart = parts.find((p) => p.type === "minute");
  const weekdayPart = parts.find((p) => p.type === "weekday");

  if (!hourPart || !minutePart || !weekdayPart) {
    // Fallback: assume within hours if we can't determine
    return {
      isWithinHours: true,
      timezone,
      message: "Chat is available",
    };
  }

  const currentHour = parseInt(hourPart.value, 10);
  const currentMinute = parseInt(minutePart.value, 10);
  const currentTime = currentHour * 60 + currentMinute;

  // Convert start and end to minutes
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDay = weekdayMap[weekdayPart.value] ?? -1;

  // Check if current day is a business day
  if (!days.includes(currentDay)) {
    return {
      isWithinHours: false,
      timezone,
      nextAvailableTime: getNextBusinessDay(days, config),
      message: `Chat is closed on ${weekdayPart.value}. We'll respond during business hours.`,
    };
  }

  // Check if current time is within hours
  const isWithinHours = currentTime >= startTime && currentTime < endTime;

  if (!isWithinHours) {
    const period = currentTime < startTime ? "before" : "after";
    const message =
      period === "before"
        ? `Chat opens at ${start}. We'll respond when we're back online.`
        : `Chat closed at ${end}. We'll respond during business hours.`;

    return {
      isWithinHours: false,
      timezone,
      nextAvailableTime:
        period === "before" ? `Today at ${start}` : getNextBusinessDay(days, config),
      message,
    };
  }

  return {
    isWithinHours: true,
    timezone,
    message: "Chat is available",
  };
}

/**
 * Get the next business day string for display
 */
function getNextBusinessDay(days: number[], config: BusinessHoursConfig): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Get current day of week
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "short",
  });

  const weekdayPart = formatter.formatToParts(now).find((p) => p.type === "weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDay = weekdayMap[weekdayPart?.value ?? "Mon"] ?? 1;

  // Find next business day
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (days.includes(nextDay)) {
      return `${dayNames[nextDay]} at ${config.start}`;
    }
  }

  return `Next business day at ${config.start}`;
}

// ============================================
// ONLINE STATUS
// ============================================

/**
 * Get online case managers for an organization
 */
export async function getOnlineCaseManagers(orgId: string): Promise<
  Array<{
    id: string;
    name: string | null;
    online: boolean;
  }>
> {
  const onlineUserIds = getOnlineUsersForOrg(orgId);

  // Get case managers for this org
  const caseManagers = await prisma.user.findMany({
    where: {
      orgId: orgId,
      isActive: true,
      role: {
        in: ["CASE_MANAGER", "PROGRAM_MANAGER", "ADMIN", "SUPER_ADMIN"],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return caseManagers.map((cm) => ({
    id: cm.id,
    name: cm.name,
    online: onlineUserIds.includes(cm.id),
  }));
}

/**
 * Check if a specific user is online
 */
export { isUserOnline };

/**
 * Get availability summary for a room
 */
export async function getRoomAvailability(
  roomId: string,
  orgId: string
): Promise<{
  withinBusinessHours: boolean;
  assignedCaseManagerOnline: boolean;
  anyCaseManagerOnline: boolean;
  message: string;
}> {
  const room = await prisma.chatRoom.findFirst({
    where: {
      id: roomId,
      organizationId: orgId,
    },
    include: {
      client: {
        select: {
          assignedTo: true,
        },
      },
    },
  });

  if (!room) {
    return {
      withinBusinessHours: false,
      assignedCaseManagerOnline: false,
      anyCaseManagerOnline: false,
      message: "Room not found",
    };
  }

  const businessHoursStatus = await isWithinBusinessHours(orgId);
  const assignedCMOnline = isUserOnline(orgId, room.client.assignedTo);
  const onlineUsers = getOnlineUsersForOrg(orgId);
  const anyCMOnline = onlineUsers.length > 0;

  let message: string;
  if (!businessHoursStatus.isWithinHours) {
    message = businessHoursStatus.message;
  } else if (assignedCMOnline) {
    message = "Your case manager is online";
  } else if (anyCMOnline) {
    message = "Case managers are available";
  } else {
    message = "No case managers currently online. We'll respond soon.";
  }

  return {
    withinBusinessHours: businessHoursStatus.isWithinHours,
    assignedCaseManagerOnline: assignedCMOnline,
    anyCaseManagerOnline: anyCMOnline,
    message,
  };
}
