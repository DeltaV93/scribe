import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listReminders, createReminder } from "@/lib/services/reminders";
import { ReminderStatus } from "@prisma/client";
import { z } from "zod";

// Validation schema for creating a reminder
const createReminderSchema = z.object({
  assignedToId: z.string().uuid().optional(), // Defaults to current user
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().datetime().transform((val) => new Date(val)),
  priority: z.number().int().min(1).max(3).optional(), // 1=High, 2=Normal, 3=Low
});

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/[clientId]/reminders - List reminders for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ReminderStatus | null;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listReminders(
      user.orgId,
      {
        clientId,
        status: status || undefined,
      },
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result.reminders,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing client reminders:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list reminders" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[clientId]/reminders - Create a reminder for a client
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;

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
      clientId,
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
