import { NextRequest, NextResponse } from "next/server";
import { validateInvitationToken } from "@/lib/services/user-invitation";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/auth/validate-invite/[token]
 * Validate an invitation token (public endpoint)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const validation = await validateInvitationToken(token);

    if (!validation.valid || !validation.invitation) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error || "Invalid invitation",
        },
        { status: 400 }
      );
    }

    const { invitation } = validation;

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        organizationName: invitation.organization.name,
        invitedBy: invitation.invitedBy.name || invitation.invitedBy.email,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}
