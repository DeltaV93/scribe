import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, unlinkGrantFromGoal } from "@/lib/services/goals";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string; grantId: string }>;
}

/**
 * DELETE /api/goals/[goalId]/grants/[grantId] - Unlink a grant from a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, grantId } = await params;

    // Only admins and program managers can unlink grants
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to unlink grants" } },
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

    await unlinkGrantFromGoal(goalId, grantId);

    return NextResponse.json({ success: true, message: "Grant unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink grant" } },
      { status: 500 }
    );
  }
}
