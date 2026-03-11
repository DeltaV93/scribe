import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getPendingInvitations,
  getAllInvitations,
} from "@/lib/services/user-invitation";
import { InvitationStatus } from "@prisma/client";

/**
 * GET /api/admin/users/invitations
 * List invitations for the organization
 * Query params:
 *   - status: filter by status (PENDING, ACCEPTED, EXPIRED, REVOKED)
 *   - all: if "true", include all invitations regardless of status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const showAll = searchParams.get("all") === "true";

    let invitations;

    if (showAll) {
      const status = statusParam
        ? (statusParam as InvitationStatus)
        : undefined;
      invitations = await getAllInvitations(user.orgId, status);
    } else {
      // Default to pending only
      invitations = await getPendingInvitations(user.orgId);
    }

    return NextResponse.json({
      data: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        name: inv.name,
        role: inv.role,
        teamId: inv.teamId,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        reminderSentAt: inv.reminderSentAt,
        invitedBy: inv.invitedBy,
        isExpired: new Date() > inv.expiresAt && inv.status === "PENDING",
      })),
    });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}
