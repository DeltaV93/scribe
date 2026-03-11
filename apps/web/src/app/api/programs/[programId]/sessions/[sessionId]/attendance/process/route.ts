import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import { processAttendanceUpload, getAttendanceUpload } from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

const processSchema = z.object({
  uploadId: z.string().uuid(),
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string }>;
};

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance/process - Trigger AI processing
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins, program managers, and case managers can trigger processing
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to process attendance" } },
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
    const validation = processSchema.safeParse(body);

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

    const { uploadId } = validation.data;

    // Verify upload exists and belongs to this session
    const upload = await getAttendanceUpload(uploadId);
    if (!upload || upload.sessionId !== sessionId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Upload not found" } },
        { status: 404 }
      );
    }

    // Check upload status
    if (upload.status !== "PHOTO_UPLOADED" && upload.status !== "FAILED") {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: `Cannot process upload in ${upload.status} state` } },
        { status: 400 }
      );
    }

    // Trigger processing (async)
    const result = await processAttendanceUpload(uploadId);

    return NextResponse.json({
      success: result.success,
      data: {
        uploadId,
        recordCount: result.recordCount,
        error: result.error,
      },
    });
  } catch (error) {
    console.error("Error processing attendance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process attendance" } },
      { status: 500 }
    );
  }
}
