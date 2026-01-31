import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReport } from "@/lib/services/reports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/[id] - Get a report with download URL
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const report = await getReport(id, user.id, user.orgId);

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error("Error getting report:", error);

    if (error instanceof Error) {
      if (error.message === "Report not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get report" } },
      { status: 500 }
    );
  }
}
