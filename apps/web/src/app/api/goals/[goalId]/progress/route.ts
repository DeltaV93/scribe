import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById } from "@/lib/services/goals";
import {
  calculateGoalProgress,
  recalculateGoalProgress,
  getGoalProgressBreakdown,
} from "@/lib/services/goal-progress";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/progress - Get goal progress calculation
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

    const breakdown = await getGoalProgressBreakdown(goalId);

    return NextResponse.json({ success: true, data: breakdown });
  } catch (error) {
    console.error("Error fetching goal progress:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch goal progress" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/[goalId]/progress - Recalculate goal progress
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can trigger recalculation
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to recalculate progress" } },
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

    const result = await recalculateGoalProgress(goalId, {
      triggerType: "manual",
      recordedById: user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        previousProgress: result.previousProgress,
        newProgress: result.newProgress,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
      },
    });
  } catch (error) {
    console.error("Error recalculating goal progress:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to recalculate goal progress" } },
      { status: 500 }
    );
  }
}
