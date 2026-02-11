import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, unlinkKpiFromGoal } from "@/lib/services/goals";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string; kpiId: string }>;
}

/**
 * DELETE /api/goals/[goalId]/kpis/[kpiId] - Unlink a KPI from a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, kpiId } = await params;

    // Only admins and program managers can unlink KPIs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to unlink KPIs" } },
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

    await unlinkKpiFromGoal(goalId, kpiId);

    return NextResponse.json({ success: true, message: "KPI unlinked successfully" });
  } catch (error) {
    console.error("Error unlinking KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to unlink KPI" } },
      { status: 500 }
    );
  }
}
