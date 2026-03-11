import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import {
  recordAttendance,
  bulkRecordAttendance,
  getSessionAttendance,
  getSessionAttendanceSummary,
  getAttendanceSheet,
} from "@/lib/services/program-attendance";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for recording attendance
const recordAttendanceSchema = z.object({
  enrollmentId: z.string().uuid(),
  attended: z.boolean(),
  hoursAttended: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// Validation schema for bulk attendance
const bulkAttendanceSchema = z.object({
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      attended: z.boolean(),
      hoursAttended: z.number().min(0).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    })
  ).min(1),
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string }>;
};

/**
 * GET /api/programs/[programId]/sessions/[sessionId]/attendance - Get attendance
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify session exists
    const session = await getSessionById(sessionId, programId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    // Check query params for format
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    if (format === "sheet") {
      // Return printable attendance sheet format
      const sheet = await getAttendanceSheet(sessionId);
      return NextResponse.json({ success: true, data: sheet });
    }

    if (format === "summary") {
      // Return summary statistics
      const summary = await getSessionAttendanceSummary(sessionId);
      return NextResponse.json({ success: true, data: summary });
    }

    // Default: return full attendance records
    const records = await getSessionAttendance(sessionId);
    const summary = await getSessionAttendanceSummary(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary,
      },
    });
  } catch (error) {
    console.error("Error getting attendance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get attendance" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance - Record attendance
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins, program managers, and case managers can record attendance
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to record attendance" } },
        { status: 403 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify session exists
    const session = await getSessionById(sessionId, programId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check if bulk recording
    if (body.records && Array.isArray(body.records)) {
      const validation = bulkAttendanceSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid attendance data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      const result = await bulkRecordAttendance({
        sessionId,
        recordedById: user.id,
        records: validation.data.records,
      });

      return NextResponse.json({
        success: true,
        data: {
          successful: result.successful,
          failed: result.failed,
        },
      });
    }

    // Single attendance record
    const validation = recordAttendanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid attendance data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const record = await recordAttendance({
      sessionId,
      enrollmentId: validation.data.enrollmentId,
      attended: validation.data.attended,
      hoursAttended: validation.data.hoursAttended,
      notes: validation.data.notes,
      recordedById: user.id,
    });

    return NextResponse.json(
      { success: true, data: record },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording attendance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to record attendance" } },
      { status: 500 }
    );
  }
}
