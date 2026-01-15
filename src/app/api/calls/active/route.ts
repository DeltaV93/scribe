import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getActiveCaseManagerCall } from "@/lib/services/calls";

/**
 * GET /api/calls/active - Get the current user's active call (if any)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const call = await getActiveCaseManagerCall(user.id, user.orgId);

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error("Error fetching active call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch active call" } },
      { status: 500 }
    );
  }
}
