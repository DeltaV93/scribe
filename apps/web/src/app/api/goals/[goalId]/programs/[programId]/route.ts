import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, unlinkProgramFromGoal } from "@/lib/services/goals";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string; programId: string }>;
}

/**
 * DELETE /api/goals/[goalId]/programs/[programId] - Unlink a program from a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, programId } = await params;

    // Only admins and program managers can unlink programs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to unlink programs" } },
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

    await unlinkProgramFromGoal(goalId, programId);

    return NextResponse.json({ success: true, message: "Program unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink program" } },
      { status: 500 }
    );
  }
}
