import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getMetricsForReportType,
  getCategories,
  ALL_METRICS,
} from "@/lib/services/reports/pre-built-metrics";
import { ReportType } from "@prisma/client";

/**
 * GET /api/reports/metrics/pre-built - Get pre-built metrics
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type") as ReportType | null;
    const category = searchParams.get("category");

    let metrics = ALL_METRICS;

    // Filter by report type
    if (reportType) {
      metrics = getMetricsForReportType(reportType);
    }

    // Filter by category
    if (category) {
      metrics = metrics.filter((m) => m.category === category);
    }

    // Get categories for filtering
    const categories = getCategories();

    return NextResponse.json({
      data: {
        metrics,
        categories,
      },
    });
  } catch (error) {
    console.error("Error getting pre-built metrics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get metrics" } },
      { status: 500 }
    );
  }
}
