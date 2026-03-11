import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, updateGoal, archiveGoal } from "@/lib/services/goals";
import { GoalType, GoalStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a goal
const updateGoalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  type: z.nativeEnum(GoalType).optional(),
  status: z.nativeEnum(GoalStatus).optional(),
  startDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  ownerId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  autoCompleteOnProgress: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId] - Get a goal by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    const goal = await getGoalById(goalId, user.orgId);

    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error("Error fetching goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch goal" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/goals/[goalId] - Update a goal
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can update goals
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update goals" } },
        { status: 403 }
      );
    }

    // Verify goal exists and belongs to org
    const existingGoal = await getGoalById(goalId, user.orgId);
    if (!existingGoal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateGoalSchema.safeParse(body);

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

    // Validate date range if dates are provided
    const startDate = data.startDate ?? existingGoal.startDate;
    const endDate = data.endDate ?? existingGoal.endDate;
    if (startDate && endDate && endDate <= startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const goal = await updateGoal(goalId, user.orgId, {
      name: data.name,
      description: data.description,
      type: data.type,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      ownerId: data.ownerId,
      teamId: data.teamId,
      autoCompleteOnProgress: data.autoCompleteOnProgress,
    });

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update goal" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/goals/[goalId] - Archive a goal (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins can archive goals
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete goals" } },
        { status: 403 }
      );
    }

    // Verify goal exists
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    await archiveGoal(goalId, user.orgId);

    return NextResponse.json({ success: true, message: "Goal archived successfully" });
  } catch (error) {
    console.error("Error archiving goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive goal" } },
      { status: 500 }
    );
  }
}
