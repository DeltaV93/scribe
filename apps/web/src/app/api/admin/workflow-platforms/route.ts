/**
 * Admin Workflow Platforms API
 *
 * Allows admins to enable/disable workflow platforms (Linear, Notion, Jira)
 * for their organization. Once enabled, users can connect their own accounts.
 *
 * GET  - Get enabled workflow platforms for org
 * PUT  - Enable/disable a workflow platform
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit/service";
import {
  getEnabledWorkflowPlatforms,
  enableFeatureFlag,
  disableFeatureFlag,
  isWorkflowPlatformEnabled,
} from "@/lib/features/flags";
import { countOrgUsersWithConnection, isPlatformConfigured } from "@/lib/integrations/base";

// Request schema for updating platform enablement
const updatePlatformSchema = z.object({
  platform: z.enum(["LINEAR", "NOTION", "JIRA"]),
  enabled: z.boolean(),
});

// Map platform to feature flag
const PLATFORM_TO_FLAG = {
  LINEAR: "workflow-linear" as const,
  NOTION: "workflow-notion" as const,
  JIRA: "workflow-jira" as const,
};

/**
 * GET /api/admin/workflow-platforms
 *
 * Returns the enabled status and user counts for all workflow platforms.
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Check admin permission
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    // 3. Get enabled platforms
    const enabledPlatforms = await getEnabledWorkflowPlatforms(user.orgId);

    // 4. Get user counts and configuration status for each platform
    const platforms = await Promise.all(
      (["LINEAR", "NOTION", "JIRA"] as const).map(async (platform) => {
        const enabled = enabledPlatforms.includes(platform);
        const configured = isPlatformConfigured(platform);
        const connectedUsers = enabled
          ? await countOrgUsersWithConnection(user.orgId, platform)
          : 0;

        return {
          platform,
          enabled,
          configured,
          connectedUsers,
        };
      })
    );

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("[Admin Workflow Platforms] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get platforms" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/workflow-platforms
 *
 * Enable or disable a workflow platform for the organization.
 * Body: { platform: "LINEAR" | "NOTION" | "JIRA", enabled: boolean }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Check admin permission
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const parseResult = updatePlatformSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { platform, enabled } = parseResult.data;
    const flag = PLATFORM_TO_FLAG[platform];

    // 4. Check if platform OAuth is configured (env vars)
    if (enabled && !isPlatformConfigured(platform)) {
      return NextResponse.json(
        {
          error: {
            code: "PLATFORM_NOT_CONFIGURED",
            message: `${platform} OAuth is not configured. Contact your system administrator.`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Check current state to avoid redundant updates
    const currentlyEnabled = await isWorkflowPlatformEnabled(user.orgId, platform);
    if (currentlyEnabled === enabled) {
      return NextResponse.json({
        success: true,
        platform,
        enabled,
        message: `${platform} is already ${enabled ? "enabled" : "disabled"}`,
      });
    }

    // 6. Update feature flag
    if (enabled) {
      await enableFeatureFlag(user.orgId, flag, user.id);
    } else {
      await disableFeatureFlag(user.orgId, flag);
    }

    // 7. Create audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "SETTING",
      resourceId: `workflow-platform:${platform}`,
      resourceName: `Workflow Platform: ${platform}`,
      details: {
        platform,
        enabled,
        action: enabled ? "platform_enabled" : "platform_disabled",
      },
    });

    console.log(
      `[Admin Workflow Platforms] ${platform} ${enabled ? "enabled" : "disabled"} for org=${user.orgId} by user=${user.id}`
    );

    // 8. Get updated user count
    const connectedUsers = enabled
      ? await countOrgUsersWithConnection(user.orgId, platform)
      : 0;

    return NextResponse.json({
      success: true,
      platform,
      enabled,
      connectedUsers,
    });
  } catch (error) {
    console.error("[Admin Workflow Platforms] PUT Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update platform" } },
      { status: 500 }
    );
  }
}
