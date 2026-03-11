import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listReports } from "@/lib/services/reports/storage";
import { ReportStatus } from "@prisma/client";

/**
 * GET /api/reports - List reports
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as ReportStatus | null;
    const templateId = searchParams.get("templateId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await listReports(user.orgId, {
      status: status || undefined,
      templateId: templateId || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.reports,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing reports:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list reports" } },
      { status: 500 }
    );
  }
}
