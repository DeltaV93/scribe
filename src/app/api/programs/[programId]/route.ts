import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getProgramById,
  updateProgram,
  archiveProgram,
  deleteProgram,
} from "@/lib/services/programs";
import { ProgramStatus, ProgramLabelType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a program
const updateProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  labelType: z.nativeEnum(ProgramLabelType).optional(),
  description: z.string().max(5000).nullable().optional(),
  requiredHours: z.number().int().min(0).nullable().optional(),
  startDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  endDate: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  schedule: z
    .object({
      daysOfWeek: z.array(z.string()).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      frequency: z.string().optional(),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  location: z.string().max(500).nullable().optional(),
  maxEnrollment: z.number().int().min(1).nullable().optional(),
  facilitatorId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(ProgramStatus).optional(),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId] - Get a program by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    const program = await getProgramById(programId, user.orgId);

    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: program });
  } catch (error) {
    console.error("Error getting program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get program" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/programs/[programId] - Update a program
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins and program managers can update programs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update programs" } },
        { status: 403 }
      );
    }

    // Verify program exists
    const existing = await getProgramById(programId, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateProgramSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid program data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const program = await updateProgram(programId, user.orgId, validation.data);

    return NextResponse.json({ success: true, data: program });
  } catch (error) {
    console.error("Error updating program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update program" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs/[programId] - Archive or delete a program
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins can delete programs
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete programs" } },
        { status: 403 }
      );
    }

    // Verify program exists
    const existing = await getProgramById(programId, user.orgId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Check if hard delete is requested
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";

    if (hardDelete) {
      await deleteProgram(programId, user.orgId);
      return NextResponse.json({ success: true, message: "Program deleted permanently" });
    } else {
      await archiveProgram(programId, user.orgId);
      return NextResponse.json({ success: true, message: "Program archived" });
    }
  } catch (error) {
    console.error("Error deleting program:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete program" } },
      { status: 500 }
    );
  }
}
