import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import {
  submitAttendanceReview,
  getAttendanceUpload,
  recordManualAttendance,
  skipAIProcessing,
} from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

const reviewRecordSchema = z.object({
  extractedRecordId: z.string().uuid(),
  enrollmentId: z.string().uuid().nullable(),
  attendanceType: z.enum(["PRESENT", "EXCUSED", "ABSENT"]),
  timeIn: z.string().datetime().nullable().optional(),
  timeOut: z.string().datetime().nullable().optional(),
  hoursAttended: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const reviewSchema = z.object({
  records: z.array(reviewRecordSchema).min(1),
  notes: z.string().max(1000).optional(),
});

const manualEntrySchema = z.object({
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      attendanceType: z.enum(["PRESENT", "EXCUSED", "ABSENT"]),
      hoursAttended: z.number().min(0).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    })
  ).min(1),
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string; uploadId: string }>;
};

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance/[uploadId]/review - Submit review
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId, uploadId } = await params;

    // Only admins and program managers can review (and facilitators)
    if (user.role === UserRole.VIEWER || user.role === UserRole.CASE_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to review attendance" } },
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

    // Verify upload exists
    const upload = await getAttendanceUpload(uploadId);
    if (!upload || upload.sessionId !== sessionId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Upload not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check query param for action type
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "skip-ai") {
      // Skip AI processing and go to manual entry
      await skipAIProcessing(uploadId);
      return NextResponse.json({
        success: true,
        message: "AI processing skipped. Upload is ready for manual entry.",
      });
    }

    if (action === "manual") {
      // Manual entry without AI review
      const validation = manualEntrySchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      const result = await recordManualAttendance({
        uploadId,
        userId: user.id,
        records: validation.data.records,
      });

      return NextResponse.json({
        success: result.success,
        data: {
          created: result.attendanceRecordsCreated,
          updated: result.attendanceRecordsUpdated,
          errors: result.errors,
        },
      });
    }

    // Default: submit AI-assisted review
    const validation = reviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Transform records
    const reviewedRecords = validation.data.records.map((r) => ({
      extractedRecordId: r.extractedRecordId,
      enrollmentId: r.enrollmentId,
      attendanceType: r.attendanceType,
      timeIn: r.timeIn ? new Date(r.timeIn) : null,
      timeOut: r.timeOut ? new Date(r.timeOut) : null,
      hoursAttended: r.hoursAttended,
      notes: r.notes,
    }));

    const result = await submitAttendanceReview({
      uploadId,
      reviewerId: user.id,
      records: reviewedRecords,
      notes: validation.data.notes,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        created: result.attendanceRecordsCreated,
        updated: result.attendanceRecordsUpdated,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to submit review" } },
      { status: 500 }
    );
  }
}
