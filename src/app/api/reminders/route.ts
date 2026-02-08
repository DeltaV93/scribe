import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createReminder,
  listReminders,
  getMyReminders,
  getReminderStats,
} from "@/lib/services/reminders";
import { ReminderStatus } from "@prisma/client";
import { z } from "zod";

// Validation schema for creating a reminder
const createReminderSchema = z.object({
  clientId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(), // Defaults to current user
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().transform((val) => new Date(val)),
  priority: z.number().int().min(1).max(3).optional(), // 1=High, 2=Normal, 3=Low
});

/**
 * GET /api/reminders - List reminders for the current user or org
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const myOnly = searchParams.get("my") === "true";
    const status = searchParams.get("status") as ReminderStatus | null;
    const clientId = searchParams.get("clientId");
    const includeOverdue = searchParams.get("includeOverdue") === "true";
    const includeStats = searchParams.get("includeStats") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Parse multiple statuses if provided as comma-separated
    const statusFilter = status
      ? (status.split(",") as ReminderStatus[])
      : undefined;

    let result;
    if (myOnly) {
      result = await getMyReminders(
        user.id,
        user.orgId,
        {
          status: statusFilter?.length === 1 ? statusFilter[0] : statusFilter,
          includeOverdue,
        },
        { page, limit }
      );
    } else {
      result = await listReminders(
        user.orgId,
        {
          status: statusFilter?.length === 1 ? statusFilter[0] : statusFilter,
          clientId: clientId || undefined,
          isOverdue: includeOverdue,
        },
        { page, limit }
      );
    }

    let stats = null;
    if (includeStats) {
      stats = await getReminderStats(user.id, user.orgId);
    }

    return NextResponse.json({
      success: true,
      data: result.reminders,
      stats,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing reminders:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list reminders" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders - Create a new reminder
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createReminderSchema.safeParse(body);

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

    const data = validation.data;

    const reminder = await createReminder({
      orgId: user.orgId,
      clientId: data.clientId,
      assignedToId: data.assignedToId || user.id,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      priority: data.priority,
    });

    return NextResponse.json(
      { success: true, data: reminder },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating reminder:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create reminder" } },
      { status: 500 }
    );
  }
}
