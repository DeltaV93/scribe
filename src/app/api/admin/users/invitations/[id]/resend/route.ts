import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { resendInvitation, getInvitationUrl } from "@/lib/services/user-invitation";
import { sendInvitationEmail } from "@/lib/services/email-notifications";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/invitations/[id]/resend
 * Resend an invitation (regenerates token and extends expiry)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const existingInvitation = await prisma.userInvitation.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!existingInvitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Resend invitation (regenerates token)
    const invitation = await resendInvitation(id);

    // Send email
    const inviteUrl = getInvitationUrl(invitation.token);
    await sendInvitationEmail(invitation.email, {
      inviteeName: invitation.name,
      inviterName: user.name || "An administrator",
      organizationName: invitation.organization.name,
      role: formatRole(invitation.role),
      inviteUrl,
      expiresAt: invitation.expiresAt,
    });

    // Log the action
    await logUserManagementAction({
      action: "USER_INVITE_RESENT",
      actorId: user.id,
      orgId: user.orgId,
      targetEmail: invitation.email,
      targetName: invitation.name,
      details: { invitationId: id, newExpiresAt: invitation.expiresAt },
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error resending invitation:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}

function formatRole(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Administrator",
    PROGRAM_MANAGER: "Program Manager",
    CASE_MANAGER: "Case Manager",
    VIEWER: "Viewer",
  };
  return roleNames[role] || role;
}
