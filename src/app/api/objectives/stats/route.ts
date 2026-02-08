import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getOKRStats } from "@/lib/services/okrs";

/**
 * GET /api/objectives/stats - Get OKR statistics for the organization
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const stats = await getOKRStats(user.orgId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching OKR stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch OKR statistics" } },
      { status: 500 }
    );
  }
}
