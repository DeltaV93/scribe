/**
 * MFA Disable API Route
 *
 * POST /api/auth/mfa/disable - Disable MFA for current user
 *   Requires MFA verification code
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disableMFA } from "@/lib/auth/mfa";
import { z } from "zod";

// Schema for disabling MFA
const disableSchema = z.object({
  verificationCode: z.string().min(1, "Verification code is required"),
});

/**
 * Disable MFA for current user
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

    const body = await request.json();
    const validation = disableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { verificationCode } = validation.data;

    const result = await disableMFA(user.id, user.id, verificationCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "MFA has been disabled for your account.",
    });
  } catch (error) {
    console.error("MFA disable error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
