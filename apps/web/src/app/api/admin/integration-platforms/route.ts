/**
 * Admin Integration Platforms API (PX-1003)
 *
 * Generic API for managing integration platforms by category.
 * Supports Communication, Documentation, ProjectManagement categories.
 *
 * GET  - Get enabled platforms for a category
 * PUT  - Enable/disable a platform
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit/service";
import {
  enableFeatureFlag,
  disableFeatureFlag,
  isFeatureEnabled,
  type FeatureFlag,
} from "@/lib/features/flags";
import { countOrgUsersWithConnection } from "@/lib/integrations/base";

// Request schemas
const getCategorySchema = z.object({
  category: z.enum(["COMMUNICATION", "DOCUMENTATION", "PROJECT_MGMT"]),
});

const updatePlatformSchema = z.object({
  platform: z.string().min(1),
  enabled: z.boolean(),
  category: z.enum(["COMMUNICATION", "DOCUMENTATION", "PROJECT_MGMT"]),
});

// Platform configuration by category
const PLATFORMS_BY_CATEGORY = {
  COMMUNICATION: ["SLACK", "GMAIL", "OUTLOOK", "TEAMS"],
  DOCUMENTATION: ["GOOGLE_DOCS", "CONFLUENCE"],
  PROJECT_MGMT: ["ASANA", "MONDAY"],
};

// Map platform to feature flag
function getPlatformFlag(platform: string): FeatureFlag {
  return `integration-${platform.toLowerCase().replace(/_/g, "-")}` as FeatureFlag;
}

// Check if platform is configured (env vars present)
function isPlatformConfigured(platform: string): boolean {
  switch (platform) {
    case "SLACK":
      return !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
    case "GMAIL":
    case "GOOGLE_DOCS":
      return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case "OUTLOOK":
    case "TEAMS":
      return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
    case "CONFLUENCE":
      return !!(process.env.ATLASSIAN_CLIENT_ID && process.env.ATLASSIAN_CLIENT_SECRET);
    case "ASANA":
      return !!(process.env.ASANA_CLIENT_ID && process.env.ASANA_CLIENT_SECRET);
    case "MONDAY":
      return !!(process.env.MONDAY_CLIENT_ID && process.env.MONDAY_CLIENT_SECRET);
    default:
      return false;
  }
}

/**
 * GET /api/admin/integration-platforms?category=COMMUNICATION
 *
 * Returns the enabled status and user counts for platforms in a category.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // 3. Parse category from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const parseResult = getCategorySchema.safeParse({ category });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid category parameter",
          },
        },
        { status: 400 }
      );
    }

    const validCategory = parseResult.data.category;
    const platformIds = PLATFORMS_BY_CATEGORY[validCategory] || [];

    // 4. Get enabled status and user counts for each platform
    const platforms = await Promise.all(
      platformIds.map(async (platform) => {
        const flag = getPlatformFlag(platform);
        const enabled = await isFeatureEnabled(user.orgId, flag);
        const configured = isPlatformConfigured(platform);

        // Only count connected users if platform is enabled
        let connectedUsers = 0;
        if (enabled) {
          try {
            connectedUsers = await countOrgUsersWithConnection(user.orgId, platform as any);
          } catch {
            // Platform might not be in IntegrationPlatform enum yet
            connectedUsers = 0;
          }
        }

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
    console.error("[Admin Integration Platforms] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get platforms" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/integration-platforms
 *
 * Enable or disable an integration platform for the organization.
 * Body: { platform: string, enabled: boolean, category: string }
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

    const { platform, enabled, category } = parseResult.data;
    const flag = getPlatformFlag(platform);

    // 4. Validate platform belongs to category
    const validPlatforms = PLATFORMS_BY_CATEGORY[category] || [];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PLATFORM",
            message: `Platform ${platform} is not in category ${category}`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Check if platform OAuth is configured (env vars)
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

    // 6. Check current state to avoid redundant updates
    const currentlyEnabled = await isFeatureEnabled(user.orgId, flag);
    if (currentlyEnabled === enabled) {
      return NextResponse.json({
        success: true,
        platform,
        enabled,
        message: `${platform} is already ${enabled ? "enabled" : "disabled"}`,
      });
    }

    // 7. Update feature flag
    if (enabled) {
      await enableFeatureFlag(user.orgId, flag, user.id);
    } else {
      await disableFeatureFlag(user.orgId, flag);
    }

    // 8. Create audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "SETTING",
      resourceId: `integration-platform:${platform}`,
      resourceName: `Integration Platform: ${platform}`,
      details: {
        platform,
        category,
        enabled,
        action: enabled ? "platform_enabled" : "platform_disabled",
      },
    });

    console.log(
      `[Admin Integration Platforms] ${platform} ${enabled ? "enabled" : "disabled"} for org=${user.orgId} by user=${user.id}`
    );

    // 9. Get updated user count
    let connectedUsers = 0;
    if (enabled) {
      try {
        connectedUsers = await countOrgUsersWithConnection(user.orgId, platform as any);
      } catch {
        connectedUsers = 0;
      }
    }

    return NextResponse.json({
      success: true,
      platform,
      enabled,
      connectedUsers,
    });
  } catch (error) {
    console.error("[Admin Integration Platforms] PUT Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update platform" } },
      { status: 500 }
    );
  }
}
