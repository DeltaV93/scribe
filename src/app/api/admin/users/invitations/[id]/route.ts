import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { revokeInvitation } from "@/lib/services/user-invitation";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/users/invitations/[id]
 * Revoke an invitation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify invitation belongs to this org
    const invitation = await prisma.userInvitation.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    await revokeInvitation(id);

    // Log the action
    await logUserManagementAction({
      action: "USER_INVITE_REVOKED",
      actorId: user.id,
      orgId: user.orgId,
      targetEmail: invitation.email,
      targetName: invitation.name,
      details: { invitationId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
