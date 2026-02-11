import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, linkObjectiveToGoal, getLinkedObjectives } from "@/lib/services/goals";
import { UserRole } from "@/types";
import { z } from "zod";

const linkObjectiveSchema = z.object({
  objectiveId: z.string().uuid(),
  weight: z.number().positive().optional(),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/objectives - Get objectives linked to a goal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Verify goal exists
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const objectives = await getLinkedObjectives(goalId);

    return NextResponse.json({ success: true, data: objectives });
  } catch (error) {
    console.error("Error fetching linked objectives:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch linked objectives" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/[goalId]/objectives - Link an objective to a goal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can link objectives
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to link objectives" } },
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

    const body = await request.json();
    const validation = linkObjectiveSchema.safeParse(body);

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

    await linkObjectiveToGoal(goalId, validation.data.objectiveId, validation.data.weight);

    return NextResponse.json(
      { success: true, message: "Objective linked successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to link objective" } },
      { status: 500 }
    );
  }
}
