import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUserById, deactivateUser } from "@/lib/services/user-management";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { notifyUserOfDeactivation } from "@/lib/services/email-notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/deactivate
 * Deactivate a user (soft delete)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Get user info before deactivation for notification
    const existingUser = await getUserById(id, currentUser.orgId);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await deactivateUser(id, currentUser.orgId, currentUser.id);

    // Log the action
    await logUserManagementAction({
      action: "USER_DEACTIVATED",
      actorId: currentUser.id,
      orgId: currentUser.orgId,
      targetUserId: id,
      targetEmail: existingUser.email,
      targetName: existingUser.name || undefined,
      details: {
        deactivatedUserRole: existingUser.role,
      },
    });

    // Notify the deactivated user
    await notifyUserOfDeactivation(existingUser.email, {
      userName: existingUser.name || existingUser.email,
      organizationName: currentUser.orgName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to deactivate user" },
      { status: 500 }
    );
  }
}
