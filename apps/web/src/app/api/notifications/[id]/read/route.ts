import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markAsRead } from "@/lib/services/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]/read - Mark a notification as read
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const notification = await markAsRead(id, user.id);

    if (!notification) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Notification not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update notification" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/[id]/read - Mark a notification as read (legacy support)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return PATCH(request, { params });
}
