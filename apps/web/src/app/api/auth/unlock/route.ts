/**
 * Admin Unlock Account API
 * POST /api/auth/unlock
 *
 * Allows admins to manually unlock user accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { unlockAccount, getLockoutStatus } from "@/lib/auth/account-lockout";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const unlockSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    const currentUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Require admin role
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const { userId } = unlockSchema.parse(body);

    // Verify the user is in the same org (unless super admin)
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      });

      if (!targetUser || targetUser.orgId !== currentUser.orgId) {
        return NextResponse.json(
          { error: "User not found or access denied" },
          { status: 404 }
        );
      }
    }

    // Check current lockout status
    const status = await getLockoutStatus(userId);

    if (!status.isLocked) {
      return NextResponse.json(
        { error: "Account is not locked" },
        { status: 400 }
      );
    }

    // Unlock the account
    await unlockAccount(userId, currentUser.id);

    return NextResponse.json({
      success: true,
      message: "Account has been unlocked",
    });
  } catch (error) {
    console.error("Error unlocking account:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to unlock account" },
      { status: 500 }
    );
  }
}

// GET endpoint to check lockout status
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Require admin role
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Verify the user is in the same org
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      });

      if (!targetUser || targetUser.orgId !== currentUser.orgId) {
        return NextResponse.json(
          { error: "User not found or access denied" },
          { status: 404 }
        );
      }
    }

    const status = await getLockoutStatus(userId);

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error getting lockout status:", error);
    return NextResponse.json(
      { error: "Failed to get lockout status" },
      { status: 500 }
    );
  }
}
