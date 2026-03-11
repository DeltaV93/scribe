import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import {
  requestAttendanceOverride,
  approveAttendanceOverride,
  rejectAttendanceOverride,
  getAttendanceUpload,
} from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

const requestOverrideSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
});

const approveOverrideSchema = z.object({
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      attendanceType: z.enum(["PRESENT", "EXCUSED", "ABSENT"]),
      hoursAttended: z.number().min(0).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    })
  ).min(1),
});

const rejectOverrideSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string; uploadId: string }>;
};

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance/[uploadId]/override - Request/approve/reject override
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId, uploadId } = await params;

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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "request";

    const body = await request.json();

    if (action === "request") {
      // Request override - any staff can request
      if (user.role === UserRole.VIEWER) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to request overrides" } },
          { status: 403 }
        );
      }

      const validation = requestOverrideSchema.safeParse(body);
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

      const result = await requestAttendanceOverride({
        uploadId,
        reason: validation.data.reason,
        requestedById: user.id,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: { code: "OPERATION_FAILED", message: result.error } },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: "Override request submitted" });
    }

    if (action === "approve") {
      // Approve override - Admin only
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Only administrators can approve overrides" } },
          { status: 403 }
        );
      }

      const validation = approveOverrideSchema.safeParse(body);
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

      const result = await approveAttendanceOverride({
        uploadId,
        approverId: user.id,
        records: validation.data.records,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: { code: "OPERATION_FAILED", message: result.error } },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Override approved",
        data: { recordsUpdated: result.recordsUpdated },
      });
    }

    if (action === "reject") {
      // Reject override - Admin only
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Only administrators can reject overrides" } },
          { status: 403 }
        );
      }

      const validation = rejectOverrideSchema.safeParse(body);
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

      const result = await rejectAttendanceOverride(
        uploadId,
        user.id,
        validation.data.reason
      );

      if (!result.success) {
        return NextResponse.json(
          { error: { code: "OPERATION_FAILED", message: result.error } },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: "Override rejected" });
    }

    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Unknown action" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error handling override:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to handle override" } },
      { status: 500 }
    );
  }
}
