import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReminderById, acknowledgeReminder } from "@/lib/services/reminders";

interface RouteParams {
  params: Promise<{ reminderId: string }>;
}

/**
 * POST /api/reminders/[reminderId]/acknowledge - Acknowledge a reminder
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { reminderId } = await params;

    // Verify reminder exists and user can acknowledge it
    const existing = await getReminderById(reminderId, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Reminder not found" } },
        { status: 404 }
      );
    }

    // Only assigned user can acknowledge (or admin)
    if (existing.assignedToId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You can only acknowledge reminders assigned to you" } },
        { status: 403 }
      );
    }

    const reminder = await acknowledgeReminder(reminderId, user.orgId);

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error("Error acknowledging reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to acknowledge reminder" } },
      { status: 500 }
    );
  }
}
