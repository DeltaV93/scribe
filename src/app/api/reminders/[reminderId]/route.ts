import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getReminderById,
  updateReminder,
  acknowledgeReminder,
  completeReminder,
  cancelReminder,
  deleteReminder,
} from "@/lib/services/reminders";
import { ReminderStatus } from "@prisma/client";
import { z } from "zod";

// Validation schema for updating a reminder
const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .optional(),
  priority: z.number().int().min(1).max(3).optional(),
  assignedToId: z.string().uuid().optional(),
  status: z.nativeEnum(ReminderStatus).optional(),
});

interface RouteParams {
  params: Promise<{ reminderId: string }>;
}

/**
 * GET /api/reminders/[reminderId] - Get a reminder
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { reminderId } = await params;

    const reminder = await getReminderById(reminderId, user.orgId);
    if (!reminder) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Reminder not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    console.error("Error fetching reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch reminder" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reminders/[reminderId] - Update a reminder
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const validation = updateReminderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const reminder = await updateReminder(reminderId, user.orgId, validation.data);

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error("Error updating reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update reminder" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders/[reminderId] - Delete a reminder
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    await deleteReminder(reminderId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Reminder deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete reminder" } },
      { status: 500 }
    );
  }
}
