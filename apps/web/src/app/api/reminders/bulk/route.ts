import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  bulkAcknowledgeReminders,
  bulkCompleteReminders,
} from "@/lib/services/reminders";
import { z } from "zod";

// Validation schema for bulk operations
const bulkOperationSchema = z.object({
  reminderIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["acknowledge", "complete"]),
});

/**
 * POST /api/reminders/bulk - Bulk operations on reminders
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = bulkOperationSchema.safeParse(body);

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

    const { reminderIds, action } = validation.data;

    let result;
    if (action === "acknowledge") {
      result = await bulkAcknowledgeReminders(reminderIds, user.orgId);
    } else {
      result = await bulkCompleteReminders(reminderIds, user.orgId, user.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        count: result.count,
        action,
      },
    });
  } catch (error) {
    console.error("Error performing bulk operation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to perform bulk operation" } },
      { status: 500 }
    );
  }
}
