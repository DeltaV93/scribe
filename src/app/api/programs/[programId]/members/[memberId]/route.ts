import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdminRole } from "@/lib/rbac";
import { ProgramMemberRole } from "@prisma/client";

// Validation schema for updating a member
const updateMemberSchema = z.object({
  role: z.nativeEnum(ProgramMemberRole).optional(),
  canEditEnrollments: z.boolean().optional(),
  canEditAttendance: z.boolean().optional(),
  canViewAllClients: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ programId: string; memberId: string }>;
}

/**
 * PATCH /api/programs/:programId/members/:memberId - Update a member's permissions
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { programId, memberId } = await context.params;

    // RBAC: Require admin to update members
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    // Verify program exists and belongs to org
    const program = await prisma.program.findFirst({
      where: { id: programId, orgId: user.orgId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify membership exists
    const existingMember = await prisma.programMember.findUnique({
      where: { id: memberId },
    });

    if (!existingMember || existingMember.programId !== programId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid member data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Update the membership
    const member = await prisma.programMember.update({
      where: { id: memberId },
      data: {
        ...(validation.data.role !== undefined && { role: validation.data.role }),
        ...(validation.data.canEditEnrollments !== undefined && {
          canEditEnrollments: validation.data.canEditEnrollments,
        }),
        ...(validation.data.canEditAttendance !== undefined && {
          canEditAttendance: validation.data.canEditAttendance,
        }),
        ...(validation.data.canViewAllClients !== undefined && {
          canViewAllClients: validation.data.canViewAllClients,
        }),
        ...(validation.data.notes !== undefined && { notes: validation.data.notes }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("Error updating program member:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update member" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs/:programId/members/:memberId - Remove a member from program
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { programId, memberId } = await context.params;

    // RBAC: Require admin to remove members
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    // Verify program exists and belongs to org
    const program = await prisma.program.findFirst({
      where: { id: programId, orgId: user.orgId },
      select: { id: true },
    });

    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify membership exists
    const existingMember = await prisma.programMember.findUnique({
      where: { id: memberId },
    });

    if (!existingMember || existingMember.programId !== programId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 }
      );
    }

    // Delete the membership
    await prisma.programMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      success: true,
      message: "Member removed from program",
    });
  } catch (error) {
    console.error("Error removing program member:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } },
      { status: 500 }
    );
  }
}
