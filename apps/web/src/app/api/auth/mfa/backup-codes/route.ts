/**
 * MFA Backup Codes API Route
 *
 * POST /api/auth/mfa/backup-codes - Regenerate backup codes
 *   Requires MFA verification before regenerating
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { regenerateBackupCodes } from "@/lib/auth/mfa";
import { z } from "zod";

// Schema for regenerating backup codes
const regenerateSchema = z.object({
  verificationCode: z.string().min(1, "Verification code is required"),
});

/**
 * Regenerate backup codes
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
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { verificationCode } = validation.data;

    const result = await regenerateBackupCodes(user.id, verificationCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        backupCodes: result.backupCodes,
        message:
          "New backup codes generated. Your previous codes are now invalid.",
      },
    });
  } catch (error) {
    console.error("Backup codes regeneration error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
