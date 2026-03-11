import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGrantById } from "@/lib/services/grants";
import { recalculateAllDeliverables } from "@/lib/services/grant-metrics";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ grantId: string }>;
}

/**
 * POST /api/grants/[grantId]/recalculate - Recalculate all deliverable metrics
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Only admins can trigger recalculation
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to recalculate metrics" } },
        { status: 403 }
      );
    }

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    await recalculateAllDeliverables(grantId, user.id);

    return NextResponse.json({
      success: true,
      message: "Deliverable metrics recalculated successfully",
    });
  } catch (error) {
    console.error("Error recalculating metrics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to recalculate metrics" } },
      { status: 500 }
    );
  }
}
