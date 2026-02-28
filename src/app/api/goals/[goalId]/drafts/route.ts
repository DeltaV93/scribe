import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById } from "@/lib/services/goals";
import {
  getPendingDraftsForGoal,
  getPendingDraftCount,
} from "@/lib/services/call-goal-drafts";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/drafts - List pending drafts for a goal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Verify goal exists and belongs to user's org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getPendingDraftCount(goalId);
      return NextResponse.json({ success: true, data: { count } });
    }

    const drafts = await getPendingDraftsForGoal(goalId);

    return NextResponse.json({
      success: true,
      data: {
        drafts,
        count: drafts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching goal drafts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch goal drafts" } },
      { status: 500 }
    );
  }
}
