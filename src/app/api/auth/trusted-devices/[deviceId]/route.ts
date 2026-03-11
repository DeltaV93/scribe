/**
 * Trusted Device API Route
 *
 * DELETE /api/auth/trusted-devices/[deviceId] - Revoke a specific trusted device
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  revokeTrustedDevice,
  getTrustedDevice,
  getTrustedDeviceCookieOptions,
} from "@/lib/auth/trusted-devices";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

/**
 * Revoke a specific trusted device
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = await params;

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

    // Get the device to verify ownership
    const device = await getTrustedDevice(deviceId);

    if (!device) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      );
    }

    // Verify the device belongs to this user
    const deviceRecord = await prisma.trustedDevice.findUnique({
      where: { id: deviceId },
      select: { userId: true },
    });

    if (deviceRecord?.userId !== dbUser.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const result = await revokeTrustedDevice(deviceId, dbUser.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Clear the trusted device cookie (in case this is the current device)
    const cookieOptions = getTrustedDeviceCookieOptions();
    const response = NextResponse.json({
      success: true,
    });

    // We can't know if this is the current device's token, but clearing the cookie
    // is safe - user will just need to remember the device again on next login
    response.cookies.delete(cookieOptions.name);

    return response;
  } catch (error) {
    console.error("Failed to revoke trusted device:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
