import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/rbac";
import { z } from "zod";

// Validation schema for creating/updating a delegation
const delegationSchema = z.object({
  userId: z.string().uuid(),
  canManageBilling: z.boolean().default(false),
  canManageTeam: z.boolean().default(false),
  canManageIntegrations: z.boolean().default(false),
  canManageBranding: z.boolean().default(false),
  expiresAt: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/admin/settings-delegation - List all settings delegations
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // RBAC: Require admin role
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    const delegations = await prisma.settingsDelegation.findMany({
      where: { orgId: user.orgId },
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
        delegator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { delegatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: delegations,
    });
  } catch (error) {
    console.error("Error listing settings delegations:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list delegations" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings-delegation - Create or update a delegation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // RBAC: Require admin role
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    const body = await request.json();
    const validation = delegationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid delegation data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Verify the target user exists and is in the same org
    const targetUser = await prisma.user.findFirst({
      where: { id: validation.data.userId, orgId: user.orgId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Don't allow delegating to admins (they already have full access)
    if (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TARGET",
            message: "Cannot delegate settings to admin users - they already have full access",
          },
        },
        { status: 400 }
      );
    }

    // Check if at least one permission is being delegated
    const hasAnyPermission =
      validation.data.canManageBilling ||
      validation.data.canManageTeam ||
      validation.data.canManageIntegrations ||
      validation.data.canManageBranding;

    // If no permissions, delete the delegation if it exists
    if (!hasAnyPermission) {
      await prisma.settingsDelegation.deleteMany({
        where: {
          orgId: user.orgId,
          userId: validation.data.userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Delegation removed",
      });
    }

    // Upsert the delegation
    const delegation = await prisma.settingsDelegation.upsert({
      where: {
        orgId_userId: {
          orgId: user.orgId,
          userId: validation.data.userId,
        },
      },
      create: {
        orgId: user.orgId,
        userId: validation.data.userId,
        canManageBilling: validation.data.canManageBilling,
        canManageTeam: validation.data.canManageTeam,
        canManageIntegrations: validation.data.canManageIntegrations,
        canManageBranding: validation.data.canManageBranding,
        delegatedBy: user.id,
        expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : null,
      },
      update: {
        canManageBilling: validation.data.canManageBilling,
        canManageTeam: validation.data.canManageTeam,
        canManageIntegrations: validation.data.canManageIntegrations,
        canManageBranding: validation.data.canManageBranding,
        delegatedBy: user.id,
        expiresAt: validation.data.expiresAt ? new Date(validation.data.expiresAt) : null,
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
      { success: true, data: delegation },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating settings delegation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create delegation" } },
      { status: 500 }
    );
  }
}
