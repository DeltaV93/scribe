import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, linkProgramToGoal, getLinkedPrograms } from "@/lib/services/goals";
import { backfillProgramData, previewBackfill } from "@/lib/services/goal-backfill";
import { UserRole } from "@/types";
import { z } from "zod";

const linkProgramSchema = z.object({
  programId: z.string().uuid(),
  backfillHistorical: z.boolean().optional().default(false),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/programs - Get programs linked to a goal
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

    const programs = await getLinkedPrograms(goalId);

    return NextResponse.json({ success: true, data: programs });
  } catch (error) {
    console.error("Error fetching linked programs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch linked programs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/[goalId]/programs - Link a program to a goal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can link programs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to link programs" } },
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
    const validation = linkProgramSchema.safeParse(body);

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

    const { programId, backfillHistorical } = validation.data;

    // Link the program
    await linkProgramToGoal(goalId, programId);

    // Optionally backfill historical data
    let backfillResult = null;
    if (backfillHistorical) {
      backfillResult = await backfillProgramData(goalId, programId);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Program linked successfully",
        data: { backfillResult },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to link program" } },
      { status: 500 }
    );
  }
}
