import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, linkGrantToGoal, getLinkedGrants } from "@/lib/services/goals";
import { UserRole } from "@/types";
import { z } from "zod";

const linkGrantSchema = z.object({
  grantId: z.string().uuid(),
  weight: z.number().positive().optional(),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/grants - Get grants linked to a goal
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

    const grants = await getLinkedGrants(goalId);

    return NextResponse.json({ success: true, data: grants });
  } catch (error) {
    console.error("Error fetching linked grants:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch linked grants" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/[goalId]/grants - Link a grant to a goal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can link grants
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to link grants" } },
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
    const validation = linkGrantSchema.safeParse(body);

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

    await linkGrantToGoal(goalId, validation.data.grantId, validation.data.weight);

    return NextResponse.json(
      { success: true, message: "Grant linked successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking grant:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to link grant" } },
      { status: 500 }
    );
  }
}
