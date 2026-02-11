import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, linkKpiToGoal, getLinkedKpis } from "@/lib/services/goals";
import { UserRole } from "@/types";
import { z } from "zod";

const linkKpiSchema = z.object({
  kpiId: z.string().uuid(),
  weight: z.number().positive().optional(),
});

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/kpis - Get KPIs linked to a goal
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

    const kpis = await getLinkedKpis(goalId);

    return NextResponse.json({ success: true, data: kpis });
  } catch (error) {
    console.error("Error fetching linked KPIs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch linked KPIs" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/[goalId]/kpis - Link a KPI to a goal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Only admins and program managers can link KPIs
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to link KPIs" } },
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
    const validation = linkKpiSchema.safeParse(body);

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

    await linkKpiToGoal(goalId, validation.data.kpiId, validation.data.weight);

    return NextResponse.json(
      { success: true, message: "KPI linked successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error linking KPI:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to link KPI" } },
      { status: 500 }
    );
  }
}
