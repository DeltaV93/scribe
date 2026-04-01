import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, publishDraftGoal, canViewDraftGoal } from "@/lib/services/goals";
import { GoalStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for publishing a draft goal
const publishGoalSchema = z.object({
  mergeIntoGoalId: z.string().uuid().optional(),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * POST /api/goals/[goalId]/publish - Publish a draft goal
 * Optionally merges into an existing goal instead of publishing as new
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can publish goals
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to publish goals" } },
        { status: 403 }
      );
    }

    // Verify goal exists and belongs to org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    // Verify goal is in draft status
    if (goal.status !== GoalStatus.DRAFT) {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Goal is not in draft status" } },
        { status: 400 }
      );
    }

    // Verify user can view this draft goal
    const canView = await canViewDraftGoal(user.id, goalId);
    if (!canView) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have access to this draft goal" } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const validation = publishGoalSchema.safeParse(body);

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

    const { mergeIntoGoalId } = validation.data;

    // If merging, verify the target goal exists and is not a draft
    if (mergeIntoGoalId) {
      const targetGoal = await getGoalById(mergeIntoGoalId, user.orgId);
      if (!targetGoal) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Target goal not found" } },
          { status: 404 }
        );
      }
      if (targetGoal.status === GoalStatus.DRAFT) {
        return NextResponse.json(
          { error: { code: "INVALID_STATE", message: "Cannot merge into another draft goal" } },
          { status: 400 }
        );
      }
    }

    const publishedGoal = await publishDraftGoal(goalId, user.orgId, {
      mergeIntoGoalId,
    });

    return NextResponse.json({
      success: true,
      data: publishedGoal,
      message: mergeIntoGoalId
        ? "Draft goal merged into existing goal"
        : "Draft goal published successfully",
    });
  } catch (error) {
    console.error("Error publishing goal:", error);
    const message = error instanceof Error ? error.message : "Failed to publish goal";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
