import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/services/notifications";

/**
 * GET /api/notifications/unread-count - Get unread notification count for badge
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const count = await getUnreadCount(user.id);

    return NextResponse.json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get unread count" } },
      { status: 500 }
    );
  }
}
