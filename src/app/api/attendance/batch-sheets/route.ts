import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import { batchGenerateAttendanceSheets } from "@/lib/services/attendance";
import { createAuditLog } from "@/lib/audit/service";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for batch generation
const batchGenerateSchema = z.object({
  programId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * POST /api/attendance/batch-sheets - Generate attendance sheets for date range
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can batch generate
    if (user.role === UserRole.VIEWER || user.role === UserRole.CASE_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to batch generate attendance sheets" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = batchGenerateSchema.safeParse(body);

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

    const { programId, startDate, endDate } = validation.data;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Validate date range (max 30 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 30) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Date range cannot exceed 30 days" } },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Start date must be before end date" } },
        { status: 400 }
      );
    }

    // Generate sheets
    const result = await batchGenerateAttendanceSheets({
      programId,
      startDate: start,
      endDate: end,
      userId: user.id,
    });

    // Create audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "GENERATE_SHEET",
      resource: "ATTENDANCE_SHEET",
      resourceId: programId,
      resourceName: program.name,
      details: {
        batchGeneration: true,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        generatedCount: result.generated.length,
        failedCount: result.failed.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          generated: result.generated,
          failed: result.failed,
          totalGenerated: result.generated.length,
          totalFailed: result.failed.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error batch generating attendance sheets:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to batch generate attendance sheets" } },
      { status: 500 }
    );
  }
}
