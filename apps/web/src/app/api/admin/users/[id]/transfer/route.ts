import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUserById, transferUserData } from "@/lib/services/user-management";
import { logUserManagementAction } from "@/lib/services/user-audit";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const transferSchema = z.object({
  toUserId: z.string().uuid("Invalid target user ID"),
  transferClients: z.boolean().default(true),
  transferSubmissions: z.boolean().default(true),
});

/**
 * POST /api/admin/users/[id]/transfer
 * Transfer user's data to another user
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

    const { id: fromUserId } = await params;

    const body = await request.json();
    const validation = transferSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { toUserId, transferClients, transferSubmissions } = validation.data;

    // Get both users for logging
    const [fromUser, toUser] = await Promise.all([
      getUserById(fromUserId, currentUser.orgId),
      getUserById(toUserId, currentUser.orgId),
    ]);

    if (!fromUser) {
      return NextResponse.json(
        { error: "Source user not found" },
        { status: 404 }
      );
    }

    if (!toUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const result = await transferUserData(
      {
        fromUserId,
        toUserId,
        transferClients,
        transferSubmissions,
      },
      currentUser.orgId
    );

    // Log the action
    await logUserManagementAction({
      action: "USER_DATA_TRANSFERRED",
      actorId: currentUser.id,
      orgId: currentUser.orgId,
      targetUserId: fromUserId,
      targetEmail: fromUser.email,
      targetName: fromUser.name || undefined,
      details: {
        toUserId,
        toUserEmail: toUser.email,
        toUserName: toUser.name,
        clientsTransferred: result.clientsTransferred,
        submissionsTransferred: result.submissionsTransferred,
      },
    });

    return NextResponse.json({
      success: true,
      transferred: {
        clients: result.clientsTransferred,
        submissions: result.submissionsTransferred,
      },
    });
  } catch (error) {
    console.error("Error transferring user data:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to transfer user data" },
      { status: 500 }
    );
  }
}
