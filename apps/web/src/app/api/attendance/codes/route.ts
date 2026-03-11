import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  generateAttendanceCodes,
  getProgramAttendanceCodes,
} from "@/lib/services/attendance";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for generating codes
const generateCodesSchema = z.object({
  programId: z.string().uuid(),
  enrollmentIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/attendance/codes - Get attendance codes for a program
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");

    if (!programId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "programId is required" } },
        { status: 400 }
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

    const codes = await getProgramAttendanceCodes(programId);

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error("Error getting attendance codes:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get attendance codes" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance/codes - Generate attendance codes
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins, program managers, and case managers can generate codes
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to generate attendance codes" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateCodesSchema.safeParse(body);

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

    const { programId, enrollmentIds } = validation.data;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const result = await generateAttendanceCodes({
      programId,
      enrollmentIds,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          generated: result.generated,
          skipped: result.skipped,
          totalGenerated: result.generated.length,
          totalSkipped: result.skipped.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error generating attendance codes:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate attendance codes" } },
      { status: 500 }
    );
  }
}
