/**
 * MFA Verify API Route
 *
 * POST /api/auth/mfa/verify - Verify MFA code (TOTP or backup code)
 *   Used during login to complete MFA challenge
 *   Supports "Remember this device" for 30 days
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { verifyMFA } from "@/lib/auth/mfa";
import {
  createTrustedDevice,
  getTrustedDeviceCookieOptions,
  parseDeviceFromRequest,
} from "@/lib/auth/trusted-devices";
import { z } from "zod";

// Schema for MFA verification
const verifySchema = z.object({
  code: z.string().min(1, "Code is required"),
  userId: z.string().uuid("Invalid user ID"),
  rememberDevice: z.boolean().optional().default(false),
});

/**
 * Verify MFA code
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current session (user has completed password auth but not MFA)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { code, userId, rememberDevice } = validation.data;

    // Verify the user ID matches the authenticated user
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: { id: true },
    });

    if (!dbUser || dbUser.id !== userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await verifyMFA(userId, code);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Prepare response data
    const responseData = {
      success: true,
      data: {
        usedBackupCode: result.usedBackupCode,
        remainingBackupCodes: result.remainingBackupCodes,
        warning:
          result.usedBackupCode && (result.remainingBackupCodes ?? 0) < 3
            ? "You are running low on backup codes. Please regenerate them."
            : undefined,
        trustedDeviceCreated: false,
      },
    };

    // If user opted to remember device, create trusted device and set cookie
    if (rememberDevice) {
      const userAgent = request.headers.get("user-agent") || "";
      const forwardedFor = request.headers.get("x-forwarded-for");
      const ipAddress = forwardedFor?.split(",")[0].trim() || "unknown";

      const { deviceInfo } = parseDeviceFromRequest(userAgent, ipAddress);

      const trustedDeviceResult = await createTrustedDevice({
        userId,
        deviceInfo,
        ipAddress,
      });

      if (trustedDeviceResult.success && trustedDeviceResult.token) {
        responseData.data.trustedDeviceCreated = true;

        const cookieOptions = getTrustedDeviceCookieOptions();
        const response = NextResponse.json(responseData);

        response.cookies.set(
          cookieOptions.name,
          trustedDeviceResult.token,
          {
            maxAge: cookieOptions.maxAge,
            httpOnly: cookieOptions.httpOnly,
            secure: cookieOptions.secure,
            sameSite: cookieOptions.sameSite,
            path: cookieOptions.path,
          }
        );

        return response;
      }
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("MFA verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
