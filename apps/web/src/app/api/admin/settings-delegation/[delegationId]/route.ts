import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ delegationId: string }>;
}

/**
 * DELETE /api/admin/settings-delegation/:delegationId - Remove a delegation
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { delegationId } = await context.params;

    // RBAC: Require admin role
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    // Verify delegation exists and belongs to org
    const delegation = await prisma.settingsDelegation.findFirst({
      where: { id: delegationId, orgId: user.orgId },
    });

    if (!delegation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Delegation not found" } },
        { status: 404 }
      );
    }

    // Delete the delegation
    await prisma.settingsDelegation.delete({
      where: { id: delegationId },
    });

    return NextResponse.json({
      success: true,
      message: "Delegation removed",
    });
  } catch (error) {
    console.error("Error deleting settings delegation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete delegation" } },
      { status: 500 }
    );
  }
}
