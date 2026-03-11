import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getProgramStats } from "@/lib/services/programs";
import { getProgramAttendanceSummary } from "@/lib/services/program-attendance";

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId]/stats - Get program statistics
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Get basic stats
    const stats = await getProgramStats(programId, user.orgId);

    // Check if detailed attendance is requested
    const { searchParams } = new URL(request.url);
    const includeAttendance = searchParams.get("attendance") === "true";

    let attendanceSummary = null;
    if (includeAttendance) {
      attendanceSummary = await getProgramAttendanceSummary(programId);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        ...(attendanceSummary && { attendanceBySession: attendanceSummary }),
      },
    });
  } catch (error) {
    console.error("Error getting program stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get program stats" } },
      { status: 500 }
    );
  }
}
