/**
 * Organization MFA Setting API Route
 *
 * PUT /api/auth/mfa/org-setting - Update organization MFA requirement
 *   Admin only - enables/disables org-wide MFA requirement
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setOrganizationMFARequirement } from "@/lib/auth/mfa";
import { UserRole } from "@/types";
import { z } from "zod";

// Schema for org MFA setting
const orgSettingSchema = z.object({
  requireMfa: z.boolean(),
});

/**
 * Update organization MFA requirement
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

    // Check admin permission
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = orgSettingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { requireMfa } = validation.data;

    const result = await setOrganizationMFARequirement(
      user.orgId,
      user.id,
      requireMfa
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: requireMfa
        ? "MFA is now required for all users in your organization."
        : "MFA is now optional for users in your organization.",
    });
  } catch (error) {
    console.error("Org MFA setting error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
