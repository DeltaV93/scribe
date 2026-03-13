/**
 * User Integrations Status
 *
 * GET - Get status of all workflow integrations for the current user
 *
 * Returns:
 * - Each platform's enabled status (admin toggle)
 * - Each platform's connection status (user connected)
 * - Connection details for connected platforms
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEnabledWorkflowPlatforms } from "@/lib/features/flags";
import {
  getUserIntegrationConnection,
  isPlatformConfigured,
} from "@/lib/integrations/base";
type WorkflowPlatform = "LINEAR" | "NOTION" | "JIRA";

const WORKFLOW_PLATFORMS: WorkflowPlatform[] = ["LINEAR", "NOTION", "JIRA"];

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

    // 2. Get enabled platforms for org
    const enabledPlatforms = await getEnabledWorkflowPlatforms(user.orgId);

    // 3. Build status for each platform
    const platforms = await Promise.all(
      WORKFLOW_PLATFORMS.map(async (platform) => {
        const isEnabled = enabledPlatforms.includes(platform);
        const isConfigured = isPlatformConfigured(platform);
        const connection = isEnabled
          ? await getUserIntegrationConnection(user.id, platform)
          : null;

        return {
          platform,
          enabled: isEnabled,
          configured: isConfigured,
          connected: connection?.status === "ACTIVE",
          connection: connection
            ? {
                id: connection.id,
                status: connection.status,
                externalUserName: connection.externalUserName,
                lastUsedAt: connection.lastUsedAt,
                lastError: connection.lastError,
                connectedAt: connection.connectedAt,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error("[User Integrations] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get integrations status" } },
      { status: 500 }
    );
  }
}
