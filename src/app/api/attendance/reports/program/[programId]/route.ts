import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getProgramAttendanceReport,
  exportProgramAttendanceCSV,
} from "@/lib/services/attendance/reports";

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/attendance/reports/program/[programId] - Get program attendance report
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Check format param
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    if (format === "csv") {
      // Return CSV export
      const csv = await exportProgramAttendanceCSV(programId, user.orgId);

      if (!csv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Program not found" } },
          { status: 404 }
        );
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="program-attendance-${programId}.csv"`,
        },
      });
    }

    // Default: return JSON report
    const report = await getProgramAttendanceReport(programId, user.orgId);

    if (!report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error getting program attendance report:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get attendance report" } },
      { status: 500 }
    );
  }
}
