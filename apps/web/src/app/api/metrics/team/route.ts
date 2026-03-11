import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { getTeamMetrics, DateRange } from "@/lib/services/staff-metrics";
import { UserRole } from "@/types";

/**
 * GET /api/metrics/team - Get team metrics (supervisor only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if feature is enabled
    const enabled = await isFeatureEnabled(user.orgId, "performance-metrics");
    if (!enabled) {
      return NextResponse.json(
        {
          error: {
            code: "FEATURE_DISABLED",
            message: "Performance metrics feature is not enabled for this organization",
          },
        },
        { status: 403 }
      );
    }

    // Check if user has supervisor access
    const supervisorRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROGRAM_MANAGER];
    if (!supervisorRoles.includes(user.role)) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view team metrics",
          },
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    // Default to last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dateRange: DateRange = {
      startDate: startDateStr ? new Date(startDateStr) : thirtyDaysAgo,
      endDate: endDateStr ? new Date(endDateStr) : now,
    };

    // Validate date range
    if (dateRange.endDate < dateRange.startDate) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "End date must be after start date",
          },
        },
        { status: 400 }
      );
    }

    // Limit date range to 1 year max
    const maxRangeDays = 365;
    const rangeDays = Math.ceil(
      (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (rangeDays > maxRangeDays) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Date range cannot exceed ${maxRangeDays} days`,
          },
        },
        { status: 400 }
      );
    }

    const metrics = await getTeamMetrics(user.id, dateRange);

    if (!metrics) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Team metrics not available" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error getting team metrics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get team metrics" } },
      { status: 500 }
    );
  }
}
