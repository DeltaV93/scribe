import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, unlinkObjectiveFromGoal } from "@/lib/services/goals";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string; objectiveId: string }>;
}

/**
 * DELETE /api/goals/[goalId]/objectives/[objectiveId] - Unlink an objective from a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, objectiveId } = await params;

    // Only admins and program managers can unlink objectives
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to unlink objectives" } },
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

    await unlinkObjectiveFromGoal(goalId, objectiveId);

    return NextResponse.json({ success: true, message: "Objective unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking objective:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink objective" } },
      { status: 500 }
    );
  }
}
