import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { acceptInvitation } from "@/lib/services/user-invitation";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { notifyAdminOfAcceptedInvitation } from "@/lib/services/email-notifications";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { UserRole } from "@prisma/client";

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").optional(), // Optional - use invitation name if not provided
});

/**
 * POST /api/auth/accept-invite
 * Accept an invitation and create user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = acceptInviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password, name } = validation.data;

    // Get invitation to get email
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        invitedBy: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation token" },
        { status: 400 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation is no longer valid" },
        { status: 400 }
      );
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Create Supabase user (using service role key for admin operations)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create the user in Supabase
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true, // Auto-confirm since we verified via invitation
        user_metadata: {
          name: name || invitation.name,
        },
      });

    if (authError) {
      console.error("Supabase auth error:", authError);

      if (authError.message.includes("already registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    // Accept invitation and create user record
    const result = await acceptInvitation(token, authData.user.id);

    if (!result.success) {
      // Rollback Supabase user if database creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: result.error || "Failed to complete registration" },
        { status: 500 }
      );
    }

    // Log the action
    await logUserManagementAction({
      action: "USER_INVITE_ACCEPTED",
      actorId: result.userId!,
      orgId: invitation.organization.id,
      targetUserId: result.userId,
      targetEmail: invitation.email,
      targetName: name || invitation.name,
      details: {
        invitedById: invitation.invitedBy.id,
        role: invitation.role,
      },
    });

    // Notify the admin who sent the invitation
    await notifyAdminOfAcceptedInvitation(invitation.invitedBy.email, {
      adminName: invitation.invitedBy.name || "Admin",
      newUserName: name || invitation.name,
      newUserEmail: invitation.email,
      newUserRole: formatRole(invitation.role),
    });

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      redirect: "/dashboard",
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Failed to accept invitation" },
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
