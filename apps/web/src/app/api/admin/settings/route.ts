import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/rbac";

/**
 * GET /api/admin/settings
 * Get organization settings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RBAC: Require admin role
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: {
        id: true,
        name: true,
        preferredAreaCode: true,
        recordingRetentionDays: true,
        consentMode: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: org });
  } catch (error) {
    console.error("Error fetching org settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings
 * Update organization settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RBAC: Require admin role
    const adminCheck = await requireAdminRole(user);
    if (!adminCheck.allowed) {
      return adminCheck.response;
    }

    const body = await request.json();
    const { preferredAreaCode, recordingRetentionDays, consentMode } = body;

    // Validate area code if provided
    if (preferredAreaCode !== undefined) {
      if (preferredAreaCode && !/^\d{3}$/.test(preferredAreaCode)) {
        return NextResponse.json(
          { error: "Invalid area code. Must be 3 digits." },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (preferredAreaCode !== undefined) {
      updateData.preferredAreaCode = preferredAreaCode || null;
    }

    if (recordingRetentionDays !== undefined) {
      updateData.recordingRetentionDays = recordingRetentionDays;
    }

    if (consentMode !== undefined) {
      updateData.consentMode = consentMode;
    }

    const org = await prisma.organization.update({
      where: { id: user.orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        preferredAreaCode: true,
        recordingRetentionDays: true,
        consentMode: true,
      },
    });

    return NextResponse.json({ data: org });
  } catch (error) {
    console.error("Error updating org settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
