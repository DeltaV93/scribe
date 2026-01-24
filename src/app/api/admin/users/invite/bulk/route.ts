import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  createBulkInvitations,
  getInvitationUrl,
} from "@/lib/services/user-invitation";
import { sendInvitationEmail } from "@/lib/services/email-notifications";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const bulkInviteSchema = z.object({
  invitations: z.array(
    z.object({
      email: z.string().email("Invalid email address"),
      name: z.string().min(1, "Name is required"),
      role: z.nativeEnum(UserRole),
      teamId: z.string().uuid().optional(),
      maxCaseload: z.number().int().positive().optional(),
    })
  ).min(1, "At least one invitation is required").max(100, "Maximum 100 invitations per batch"),
});

/**
 * POST /api/admin/users/invite/bulk
 * Send multiple user invitations (CSV upload)
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
    const validation = bulkInviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { invitations } = validation.data;

    // Create invitations
    const result = await createBulkInvitations(
      invitations,
      user.id,
      user.orgId
    );

    // Send emails for successful invitations
    // Note: In production, this should be queued
    for (const success of result.successful) {
      try {
        // Get the invitation to get the token
        const { prisma } = await import("@/lib/db");
        const invitation = await prisma.userInvitation.findFirst({
          where: {
            email: success.email.toLowerCase(),
            orgId: user.orgId,
            status: "PENDING",
          },
          include: {
            organization: { select: { name: true } },
          },
        });

        if (invitation) {
          const inviteUrl = getInvitationUrl(invitation.token);
          await sendInvitationEmail(success.email, {
            inviteeName: success.name,
            inviterName: user.name || "An administrator",
            organizationName: invitation.organization.name,
            role: formatRole(invitations.find((i) => i.email === success.email)?.role || UserRole.CASE_MANAGER),
            inviteUrl,
            expiresAt: invitation.expiresAt,
          });
        }
      } catch (emailError) {
        console.error(`Failed to send email to ${success.email}:`, emailError);
      }
    }

    // Log the bulk action
    await logUserManagementAction({
      action: "USER_INVITED",
      actorId: user.id,
      orgId: user.orgId,
      details: {
        bulk: true,
        count: result.successful.length,
        failed: result.failed.length,
        emails: result.successful.map((s) => s.email),
      },
    });

    return NextResponse.json({
      success: true,
      results: {
        successful: result.successful,
        failed: result.failed,
        summary: {
          total: invitations.length,
          sent: result.successful.length,
          failed: result.failed.length,
        },
      },
    });
  } catch (error) {
    console.error("Error creating bulk invitations:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to send invitations" },
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
