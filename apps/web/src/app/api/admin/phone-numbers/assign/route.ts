import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  assignNumberFromPool,
  purchaseAndAssignNumber,
} from "@/lib/services/phone-number-management";
import { notifyUserOfAssignment } from "@/lib/services/email-notifications";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/phone-numbers/assign
 * Assign a number to a user (from pool or purchase new)
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
    const { userId, poolNumberId, areaCode } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Verify user belongs to same org
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true, email: true },
    });

    if (!targetUser || targetUser.orgId !== user.orgId) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    let result: { phoneNumber: string };

    if (poolNumberId) {
      // Assign from pool
      result = await assignNumberFromPool(userId, poolNumberId);
    } else {
      // Purchase and assign new number
      result = await purchaseAndAssignNumber(userId, user.orgId, areaCode);
    }

    // Notify user
    await notifyUserOfAssignment(targetUser.email, result.phoneNumber);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("Error assigning number:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign number" },
      { status: 500 }
    );
  }
}
