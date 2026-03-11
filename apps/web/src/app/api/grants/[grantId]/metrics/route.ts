import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGrantById } from "@/lib/services/grants";
import { getMetricSummary } from "@/lib/services/grant-metrics";

interface RouteParams {
  params: Promise<{ grantId: string }>;
}

/**
 * GET /api/grants/[grantId]/metrics - Get metric summary for a grant
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { grantId } = await params;

    // Verify grant exists and belongs to org
    const grant = await getGrantById(grantId, user.orgId);
    if (!grant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Grant not found" } },
        { status: 404 }
      );
    }

    const summary = await getMetricSummary(grantId);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching metric summary:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch metric summary" } },
      { status: 500 }
    );
  }
}
