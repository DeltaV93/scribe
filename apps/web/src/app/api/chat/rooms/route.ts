/**
 * GET /api/chat/rooms - List active chat rooms for case manager
 *
 * @see PX-713 - Real-Time Chat
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRooms, getUnreadCount } from "@/lib/services/realtime-chat";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const assignedTo = searchParams.get("assignedTo");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const cursor = searchParams.get("cursor") || undefined;

    // Get active rooms
    const { rooms, nextCursor } = await getActiveRooms(user.orgId, {
      assignedTo: assignedTo === "me" ? user.id : assignedTo || undefined,
      limit,
      cursor,
    });

    // Get unread counts for each room
    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await getUnreadCount(room.id, user.orgId, "CASE_MANAGER");
        return {
          id: room.id,
          clientId: room.clientId,
          clientName: room.client
            ? `${room.client.firstName} ${room.client.lastName}`
            : "Unknown",
          assignedTo: room.client?.assignedTo,
          isActive: room.isActive,
          lastActivityAt: room.lastActivityAt.toISOString(),
          createdAt: room.createdAt.toISOString(),
          unreadCount,
        };
      })
    );

    return NextResponse.json({
      rooms: roomsWithUnread,
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat rooms" },
      { status: 500 }
    );
  }
}
