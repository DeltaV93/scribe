/**
 * MFA Status API Route
 *
 * GET /api/auth/mfa/status - Get current user's MFA status
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMFAStatus } from "@/lib/auth/mfa";

/**
 * Get MFA status
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const status = await getMFAStatus(user.id);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("MFA status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
