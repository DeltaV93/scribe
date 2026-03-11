import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramById } from "@/lib/services/programs";
import {
  getEnrollmentById,
  updateEnrollment,
  withdrawClient,
  deleteEnrollment,
  setHoursOverride,
  getHoursSummary,
} from "@/lib/services/program-enrollments";
import { EnrollmentStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating an enrollment
const updateEnrollmentSchema = z.object({
  status: z.nativeEnum(EnrollmentStatus).optional(),
  hoursOverride: z.number().min(0).nullable().optional(),
  completionDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  withdrawalDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  withdrawalReason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

type RouteParams = {
  params: Promise<{ programId: string; enrollmentId: string }>;
};

/**
 * GET /api/programs/[programId]/enrollments/[enrollmentId] - Get enrollment details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, enrollmentId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const enrollment = await getEnrollmentById(enrollmentId, programId);
    if (!enrollment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Enrollment not found" } },
        { status: 404 }
      );
    }

    // Include hours summary
    const hoursSummary = await getHoursSummary(enrollmentId);

    return NextResponse.json({
      success: true,
      data: {
        ...enrollment,
        hoursSummary,
      },
    });
  } catch (error) {
    console.error("Error getting enrollment:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get enrollment" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/programs/[programId]/enrollments/[enrollmentId] - Update enrollment
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, enrollmentId } = await params;

    // Only admins, program managers, and case managers can update enrollments
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update enrollments" } },
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

    // Verify enrollment exists
    const existing = await getEnrollmentById(enrollmentId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Enrollment not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check for special actions
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "withdraw") {
      const reason = body.withdrawalReason || undefined;
      const enrollment = await withdrawClient(enrollmentId, programId, reason);
      return NextResponse.json({ success: true, data: enrollment });
    }

    if (action === "setHoursOverride") {
      const hours = body.hoursOverride ?? null;
      const enrollment = await setHoursOverride(enrollmentId, programId, hours);
      return NextResponse.json({ success: true, data: enrollment });
    }

    // Standard update
    const validation = updateEnrollmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid enrollment data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const enrollment = await updateEnrollment(enrollmentId, programId, validation.data);

    return NextResponse.json({ success: true, data: enrollment });
  } catch (error) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update enrollment" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs/[programId]/enrollments/[enrollmentId] - Delete enrollment
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, enrollmentId } = await params;

    // Only admins can delete enrollments
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete enrollments" } },
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

    // Verify enrollment exists
    const existing = await getEnrollmentById(enrollmentId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Enrollment not found" } },
        { status: 404 }
      );
    }

    await deleteEnrollment(enrollmentId, programId);

    return NextResponse.json({ success: true, message: "Enrollment deleted" });
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete enrollment" } },
      { status: 500 }
    );
  }
}
