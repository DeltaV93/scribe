import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPendingOverrideRequests } from "@/lib/services/attendance/override-workflow";

/**
 * GET /api/attendance/overrides - Get pending override requests for the org
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const overrides = await getPendingOverrideRequests(user.orgId);

    return NextResponse.json({
      success: true,
      data: overrides,
    });
  } catch (error) {
    console.error("Error getting overrides:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get overrides" } },
      { status: 500 }
    );
  }
}
