/**
 * GET /api/chat/rooms/:roomId/messages - Get message history
 * POST /api/chat/rooms/:roomId/messages - Send message (REST fallback)
 *
 * @see PX-713 - Real-Time Chat
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getMessageHistory,
  sendMessage,
  getRoomById,
} from "@/lib/services/realtime-chat";

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

/**
 * GET - Get message history for a room
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const before = searchParams.get("before") || undefined;
    const after = searchParams.get("after") || undefined;

    // Verify room access
    const room = await getRoomById(roomId, user.orgId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Get message history
    const { messages, hasMore } = await getMessageHistory(
      roomId,
      user.orgId,
      { limit, before, after }
    );

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        senderId: m.senderId,
        senderType: m.senderType,
        senderName: m.senderName,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        readAt: m.readAt?.toISOString(),
      })),
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST - Send a message (REST fallback when WebSocket unavailable)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await context.params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify room access
    const room = await getRoomById(roomId, user.orgId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Send message
    const message = await sendMessage(
      roomId,
      user.orgId,
      user.id,
      "CASE_MANAGER",
      content.trim()
    );

    return NextResponse.json({
      message: {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        moderation: message.moderation,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    const message = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
