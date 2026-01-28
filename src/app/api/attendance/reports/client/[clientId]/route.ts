import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientAttendanceReport } from "@/lib/services/attendance/reports";

type RouteParams = {
  params: Promise<{ clientId: string }>;
};

/**
 * GET /api/attendance/reports/client/[clientId] - Get client attendance report
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { clientId } = await params;

    const report = await getClientAttendanceReport(clientId, user.orgId);

    if (!report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error getting client attendance report:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get attendance report" } },
      { status: 500 }
    );
  }
}
