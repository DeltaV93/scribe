import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { getProgramMetrics, DateRange } from "@/lib/services/staff-metrics";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ programId: string }>;
}

/**
 * GET /api/metrics/programs/:programId - Get metrics for a specific program
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

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

    // Verify program belongs to user's org
    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        orgId: user.orgId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
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

    const metrics = await getProgramMetrics(programId, dateRange);

    if (!metrics) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program metrics not available" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error getting program metrics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get program metrics" } },
      { status: 500 }
    );
  }
}
