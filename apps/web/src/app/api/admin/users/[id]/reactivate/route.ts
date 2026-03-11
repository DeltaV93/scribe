import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUserById, reactivateUser } from "@/lib/services/user-management";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { notifyUserOfReactivation } from "@/lib/services/email-notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/reactivate
 * Reactivate a deactivated user
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

    // Get user info for notification
    const existingUser = await getUserById(id, currentUser.orgId);
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await reactivateUser(id, currentUser.orgId);

    // Log the action
    await logUserManagementAction({
      action: "USER_REACTIVATED",
      actorId: currentUser.id,
      orgId: currentUser.orgId,
      targetUserId: id,
      targetEmail: existingUser.email,
      targetName: existingUser.name || undefined,
    });

    // Notify the reactivated user
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
    await notifyUserOfReactivation(existingUser.email, {
      userName: existingUser.name || existingUser.email,
      organizationName: currentUser.orgName,
      loginUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reactivating user:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to reactivate user" },
      { status: 500 }
    );
  }
}
