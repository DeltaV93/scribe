/**
 * Feature Flags Admin API
 * GET /api/admin/feature-flags - Get all feature flags
 * PUT /api/admin/feature-flags - Update feature flags
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeatureFlags, setFeatureFlags, type FeatureFlag } from "@/lib/features/flags";
import { createAuditLog } from "@/lib/audit/service";
import { isAdminRole } from "@/lib/rbac/permissions";
import type { UserRole } from "@/types";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // Only admins can view feature flags
  if (!isAdminRole(user.role as UserRole)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      { status: 403 }
    );
  }

  try {
    const flags = await getFeatureFlags(user.orgId);

    return NextResponse.json({
      success: true,
      data: flags,
    });
  } catch (error) {
    console.error("[FeatureFlags] GET error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get feature flags" } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  // Only admins can update feature flags
  if (!isAdminRole(user.role as UserRole)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      { status: 403 }
    );
  }

  let body: { flags: Partial<Record<FeatureFlag, boolean>> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  if (!body.flags || typeof body.flags !== "object") {
    return NextResponse.json(
      { error: { code: "INVALID_FLAGS", message: "Flags object is required" } },
      { status: 400 }
    );
  }

  try {
    await setFeatureFlags(user.orgId, body.flags, user.id);

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "SETTING",
      resourceId: "feature-flags",
      details: {
        updatedFlags: body.flags,
      },
    });

    // Return updated flags
    const updatedFlags = await getFeatureFlags(user.orgId);

    return NextResponse.json({
      success: true,
      data: updatedFlags,
    });
  } catch (error) {
    console.error("[FeatureFlags] PUT error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update feature flags" } },
      { status: 500 }
    );
  }
}
