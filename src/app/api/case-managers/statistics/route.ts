import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCaseloadStatistics } from "@/lib/services/client-matching";
import { UserRole } from "@/types";

/**
 * GET /api/case-managers/statistics
 * Get caseload statistics for all case managers in the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can view statistics
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view statistics" } },
        { status: 403 }
      );
    }

    const statistics = await getCaseloadStatistics(user.orgId);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCaseManagers: statistics.total,
          available: statistics.available,
          atCapacity: statistics.atCapacity,
          unavailable: statistics.unavailable,
          averageUtilization: statistics.averageLoad,
        },
        caseManagers: statistics.caseManagers.map((cm) => ({
          id: cm.id,
          name: cm.name,
          currentCaseload: cm.currentCaseload,
          maxCaseload: cm.maxCaseload,
          utilizationPercent: cm.utilizationPercent,
          spotsAvailable: cm.maxCaseload - cm.currentCaseload,
          availabilityStatus: cm.availabilityStatus,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting caseload statistics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get caseload statistics" } },
      { status: 500 }
    );
  }
}
