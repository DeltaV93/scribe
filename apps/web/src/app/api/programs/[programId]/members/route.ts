import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkScopedPermission, requireAdminRole } from "@/lib/rbac";
import { ProgramMemberRole } from "@prisma/client";

// Validation schema for adding a member
const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(ProgramMemberRole).default("CASE_MANAGER"),
  canEditEnrollments: z.boolean().default(false),
  canEditAttendance: z.boolean().default(true),
  canViewAllClients: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

interface RouteContext {
  params: Promise<{ programId: string }>;
}

/**
 * GET /api/programs/:programId/members - List program members
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { programId } = await context.params;

    // RBAC: Check program read permission
    const permissionCheck = await checkScopedPermission(
      user,
      "programs",
      "read",
      { programId }
    );
    if (!permissionCheck.allowed) {
      return permissionCheck.response;
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

    // Get all members
    const members = await prisma.programMember.findMany({
      where: { programId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        assigner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { assignedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error("Error listing program members:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list members" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs/:programId/members - Add a program member
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { programId } = await context.params;

    // RBAC: Require admin to add members
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

    const body = await request.json();
    const validation = addMemberSchema.safeParse(body);

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

    // Verify the user to add exists and is in the same org
    const targetUser = await prisma.user.findFirst({
      where: { id: validation.data.userId, orgId: user.orgId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.programMember.findUnique({
      where: {
        programId_userId: {
          programId,
          userId: validation.data.userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "User is already a member of this program",
          },
        },
        { status: 409 }
      );
    }

    // Create the membership
    const member = await prisma.programMember.create({
      data: {
        programId,
        userId: validation.data.userId,
        role: validation.data.role,
        canEditEnrollments: validation.data.canEditEnrollments,
        canEditAttendance: validation.data.canEditAttendance,
        canViewAllClients: validation.data.canViewAllClients,
        notes: validation.data.notes,
        assignedBy: user.id,
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

    return NextResponse.json(
      { success: true, data: member },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding program member:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add member" } },
      { status: 500 }
    );
  }
}
