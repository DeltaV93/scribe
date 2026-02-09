import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getPlacementStats,
  getRecentPlacements,
  getPlacementRate,
} from "@/lib/services/job-placements";
import { prisma } from "@/lib/db";

/**
 * GET /api/placements/stats - Get organization-wide placement statistics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeRecent = searchParams.get("includeRecent") === "true";
    const recentLimit = parseInt(searchParams.get("recentLimit") || "5", 10);

    const [stats, placementRate, recentPlacements] = await Promise.all([
      getPlacementStats(user.orgId),
      getPlacementRate(user.orgId),
      includeRecent ? getRecentPlacements(user.orgId, recentLimit) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        placementRate,
        ...(includeRecent && { recentPlacements }),
      },
    });
  } catch (error) {
    console.error("Error fetching placement stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch placement statistics" } },
      { status: 500 }
    );
  }
}
