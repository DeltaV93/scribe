/**
 * Trusted Devices API Route
 *
 * GET /api/auth/trusted-devices - List user's trusted devices
 * DELETE /api/auth/trusted-devices - Revoke all user's trusted devices
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  listTrustedDevices,
  revokeAllTrustedDevices,
  getTrustedDeviceCookieOptions,
  TRUSTED_DEVICE_CONFIG,
} from "@/lib/auth/trusted-devices";

/**
 * List user's trusted devices
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const result = await listTrustedDevices(dbUser.id);

    return NextResponse.json({
      success: true,
      data: {
        devices: result.devices,
        total: result.total,
        maxDevices: TRUSTED_DEVICE_CONFIG.maxDevices,
      },
    });
  } catch (error) {
    console.error("Failed to list trusted devices:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Revoke all user's trusted devices
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const result = await revokeAllTrustedDevices(
      dbUser.id,
      dbUser.id,
      "USER_REQUEST"
    );

    // Clear the trusted device cookie
    const cookieOptions = getTrustedDeviceCookieOptions();
    const response = NextResponse.json({
      success: true,
      data: {
        revokedCount: result.revokedCount,
      },
    });

    response.cookies.delete(cookieOptions.name);

    return response;
  } catch (error) {
    console.error("Failed to revoke all trusted devices:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
