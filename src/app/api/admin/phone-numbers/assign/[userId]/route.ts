import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { unassignNumber } from "@/lib/services/phone-number-management";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/admin/phone-numbers/assign/[userId]
 * Unassign a number from a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId: targetUserId } = await params;
    const { searchParams } = new URL(request.url);
    const returnToPool = searchParams.get("returnToPool") === "true";

    // Verify user belongs to same org
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { orgId: true },
    });

    if (!targetUser || targetUser.orgId !== user.orgId) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    await unassignNumber(targetUserId, user.orgId, returnToPool);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unassigning number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unassign number" },
      { status: 500 }
    );
  }
}
