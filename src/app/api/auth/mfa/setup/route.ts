/**
 * MFA Setup API Route
 *
 * POST /api/auth/mfa/setup - Initialize MFA setup
 *   Returns QR code and manual entry key for authenticator app
 *
 * PUT /api/auth/mfa/setup - Complete MFA setup
 *   Verifies code and enables MFA, returns backup codes
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initializeMFASetup, enableMFA } from "@/lib/auth/mfa";
import { z } from "zod";

// Schema for completing MFA setup
const completeSetupSchema = z.object({
  secret: z.string().min(16, "Invalid secret"),
  verificationCode: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

/**
 * Initialize MFA setup
 */
export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await initializeMFASetup(user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Return setup data (but not the raw secret to store client-side)
    return NextResponse.json({
      success: true,
      data: {
        qrCodeDataURL: result.setupData!.qrCodeDataURL,
        manualEntryKey: result.setupData!.manualEntryKey,
        secret: result.setupData!.secret, // Needed for verification step
      },
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Complete MFA setup
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = completeSetupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { secret, verificationCode } = validation.data;

    const result = await enableMFA(user.id, secret, verificationCode);

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
        message: "MFA enabled successfully. Save your backup codes securely.",
      },
    });
  } catch (error) {
    console.error("MFA enable error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
