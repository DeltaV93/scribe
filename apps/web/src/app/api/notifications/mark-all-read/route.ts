import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markAllAsRead } from "@/lib/services/notifications";
import { handleApiError } from "@/lib/api/errors";

/**
 * POST /api/notifications/mark-all-read - Mark all notifications as read
 */
export async function POST() {
  try {
    const user = await requireAuth();

    const result = await markAllAsRead(user.id);

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read",
      data: {
        count: result.count,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to mark notifications as read");
  }
}
