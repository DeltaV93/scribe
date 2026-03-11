import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  createInvitation,
  getInvitationUrl,
} from "@/lib/services/user-invitation";
import { sendInvitationEmail } from "@/lib/services/email-notifications";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.nativeEnum(UserRole),
  teamId: z.string().uuid().optional(),
  maxCaseload: z.number().int().positive().optional(),
});

/**
 * POST /api/admin/users/invite
 * Send a single user invitation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validation = inviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, role, teamId, maxCaseload } = validation.data;

    // Create invitation
    const invitation = await createInvitation({
      email,
      name,
      role,
      teamId,
      maxCaseload,
      invitedById: user.id,
      orgId: user.orgId,
    });

    // Send invitation email
    const inviteUrl = getInvitationUrl(invitation.token);
    await sendInvitationEmail(email, {
      inviteeName: name,
      inviterName: user.name || "An administrator",
      organizationName: invitation.organization.name,
      role: formatRole(role),
      inviteUrl,
      expiresAt: invitation.expiresAt,
    });

    // Log the action
    await logUserManagementAction({
      action: "USER_INVITED",
      actorId: user.id,
      orgId: user.orgId,
      targetEmail: email,
      targetName: name,
      details: { role, teamId, invitationId: invitation.id },
    });

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error creating invitation:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to send invitation" },
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
    FACILITATOR: "Facilitator",
    VIEWER: "Viewer",
  };
  return roleNames[role] || role;
}
