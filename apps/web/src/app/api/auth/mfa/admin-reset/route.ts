/**
 * MFA Admin Reset API Route
 *
 * POST /api/auth/mfa/admin-reset - Admin resets MFA for a user
 *   Used when a user is locked out of their account
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminResetMFA } from "@/lib/auth/mfa";
import { UserRole } from "@/types";
import { z } from "zod";

// Schema for admin reset
const adminResetSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

/**
 * Admin reset MFA for a user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin permission
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = adminResetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { userId } = validation.data;

    const result = await adminResetMFA(userId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "MFA has been reset for the user. They will need to set up MFA again.",
    });
  } catch (error) {
    console.error("MFA admin reset error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
