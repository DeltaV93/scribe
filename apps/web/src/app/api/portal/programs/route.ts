import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/services/portal-sessions";
import { getClientEnrollments } from "@/lib/services/program-enrollments";
import { getSessionFromCookie } from "@/lib/portal/cookies";

/**
 * GET /api/portal/programs - Get client's program enrollments with progress
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = getSessionFromCookie(request);

    if (!sessionToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "No session cookie" } },
        { status: 401 }
      );
    }

    const session = await validateSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } },
        { status: 401 }
      );
    }

    // Get client's program enrollments
    const enrollments = await getClientEnrollments(
      session.clientId,
      session.client.orgId
    );

    // Transform for portal display
    const programs = enrollments.map((summary) => ({
      id: summary.enrollment.id,
      programId: summary.enrollment.programId,
      programName: summary.programName,
      status: summary.enrollment.status,
      enrolledDate: summary.enrollment.enrolledDate,
      completionDate: summary.enrollment.completionDate,
      hoursCompleted: summary.enrollment.effectiveHours,
      hoursRequired: summary.enrollment.program?.requiredHours || null,
      progressPercentage: summary.progressPercentage,
      sessionsAttended: summary.sessionsAttended,
      totalSessions: summary.totalSessions,
    }));

    return NextResponse.json({
      success: true,
      data: {
        enrollments: programs,
      },
    });
  } catch (error) {
    console.error("Error fetching portal programs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch programs" } },
      { status: 500 }
    );
  }
}
