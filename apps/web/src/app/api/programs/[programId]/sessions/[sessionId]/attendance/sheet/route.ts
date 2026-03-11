import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById, getSessionById } from "@/lib/services/programs";
import { generateAttendanceSheet, getAttendanceSheetUrl } from "@/lib/services/attendance";
import { createAuditLog } from "@/lib/audit/service";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for generating sheet
const generateSheetSchema = z.object({
  date: z.string().datetime().optional(), // Optional override date
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string }>;
};

/**
 * POST /api/programs/[programId]/sessions/[sessionId]/attendance/sheet - Generate attendance sheet
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins, program managers, and case managers can generate sheets
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to generate attendance sheets" } },
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

    // Parse optional body
    let date: Date | undefined;
    const contentType = request.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      try {
        const body = await request.json();
        const validation = generateSheetSchema.safeParse(body);
        if (validation.success && validation.data.date) {
          date = new Date(validation.data.date);
        }
      } catch {
        // Body is optional, continue without it
      }
    }

    // Generate the attendance sheet
    const result = await generateAttendanceSheet({
      sessionId,
      date,
      userId: user.id,
    });

    // Create audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "GENERATE_SHEET",
      resource: "ATTENDANCE_SHEET",
      resourceId: result.uploadId,
      resourceName: result.fileName,
      details: {
        sessionId,
        programId,
        sessionNumber: session.sessionNumber,
      },
    });

    // Check query param for response format
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    if (format === "download") {
      // Return PDF directly for download - convert Buffer to Uint8Array for NextResponse
      return new NextResponse(new Uint8Array(result.pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
          "Content-Length": result.pdfBuffer.length.toString(),
        },
      });
    }

    // Default: return metadata with optional signed URL
    let downloadUrl: string | undefined;
    if (result.s3Key) {
      try {
        downloadUrl = await getAttendanceSheetUrl(result.s3Key);
      } catch (error) {
        console.error("Failed to generate signed URL:", error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          uploadId: result.uploadId,
          fileName: result.fileName,
          s3Key: result.s3Key,
          downloadUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error generating attendance sheet:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate attendance sheet" } },
      { status: 500 }
    );
  }
}
