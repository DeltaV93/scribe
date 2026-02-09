import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead } from "@/lib/services/notifications";

/**
 * GET /api/notifications - List notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const cursor = searchParams.get("cursor") ?? undefined;

    const result = await listNotifications({
      userId: user.id,
      unreadOnly,
      limit: Math.min(limit, 100),
      offset: cursor ? undefined : offset, // Don't use offset if cursor is provided
      cursor,
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications: result.items,
        cursor: result.cursor,
        hasMore: result.hasMore,
      },
      pagination: {
        total: result.total,
        limit,
        offset,
      },
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error("Error listing notifications:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list notifications" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications - Mark all notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();

    if (body.action === "mark-all-read") {
      const result = await markAllNotificationsRead(user.id);

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
        count: result.count,
      });
    }

    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Invalid action" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update notifications" } },
      { status: 500 }
    );
  }
}
