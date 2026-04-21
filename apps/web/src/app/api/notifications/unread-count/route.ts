import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/services/notifications";
import { handleApiError } from "@/lib/api/errors";

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
    return handleApiError(error, "Failed to get unread count");
  }
}
