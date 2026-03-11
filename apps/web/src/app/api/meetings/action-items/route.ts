/**
 * User Action Items API
 *
 * GET /api/meetings/action-items - Get action items assigned to the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserActionItems } from "@/lib/services/meetings";

/**
 * Get action items assigned to the current user across all meetings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;

    const actionItems = await getUserActionItems(
      user.id,
      user.orgId,
      status
    );

    return NextResponse.json({ success: true, data: actionItems });
  } catch (error) {
    console.error("Error getting user action items:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get action items" } },
      { status: 500 }
    );
  }
}
