import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createGoal, listGoals } from "@/lib/services/goals";
import { GoalType, GoalStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a goal
const createGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  type: z.nativeEnum(GoalType),
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

/**
 * GET /api/goals - List goals for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as GoalType | null;
    const status = searchParams.get("status") as GoalStatus | null;
    const ownerId = searchParams.get("ownerId") || undefined;
    const teamId = searchParams.get("teamId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listGoals(
      user.orgId,
      {
        type: type || undefined,
        status: status || undefined,
        ownerId,
        teamId,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.goals,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error("Error listing goals:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list goals" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals - Create a new goal
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can create goals
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create goals" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createGoalSchema.safeParse(body);

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

    // Validate date range if both dates provided
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "End date must be after start date" } },
        { status: 400 }
      );
    }

    const goal = await createGoal({
      orgId: user.orgId,
      createdById: user.id,
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

    return NextResponse.json({ success: true, data: goal }, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create goal" } },
      { status: 500 }
    );
  }
}
