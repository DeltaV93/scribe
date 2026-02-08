import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReminderById, completeReminder } from "@/lib/services/reminders";

interface RouteParams {
  params: Promise<{ reminderId: string }>;
}

/**
 * POST /api/reminders/[reminderId]/complete - Mark a reminder as complete
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { reminderId } = await params;

    // Verify reminder exists
    const existing = await getReminderById(reminderId, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Reminder not found" } },
        { status: 404 }
      );
    }

    // Only assigned user can complete (or admin)
    if (existing.assignedToId !== user.id && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You can only complete reminders assigned to you" } },
        { status: 403 }
      );
    }

    const reminder = await completeReminder(reminderId, user.orgId, user.id);

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error("Error completing reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to complete reminder" } },
      { status: 500 }
    );
  }
}
