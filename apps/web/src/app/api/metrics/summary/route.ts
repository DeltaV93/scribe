import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { getOrgSummaryMetrics, DateRange } from "@/lib/services/staff-metrics";
import { UserRole } from "@/types";

/**
 * GET /api/metrics/summary - Get org-wide metrics summary (admin only)
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

    // Only admins can view org-wide summary
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view organization metrics",
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

    const summary = await getOrgSummaryMetrics(user.orgId, dateRange);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error getting org summary metrics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get organization metrics" } },
      { status: 500 }
    );
  }
}
