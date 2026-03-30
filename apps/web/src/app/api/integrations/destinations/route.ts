/**
 * Integration Destinations API (PX-1004)
 *
 * GET /api/integrations/destinations - Get available destinations for pushing outputs
 *
 * Returns the user's connected integrations that can receive the specified output type.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getUserConnections,
  isPlatformConfigured,
} from "@/lib/integrations/base/user-token-store";
import {
  OUTPUT_COMPATIBILITY,
  OutputType,
} from "@/lib/integrations/base/output-types";
import { isWorkflowPlatformEnabled } from "@/lib/features/flags";
import type { IntegrationPlatform, WorkflowOutputType } from "@prisma/client";

// Platform display names (only platforms in IntegrationPlatform enum)
const PLATFORM_DISPLAY_NAMES: Record<IntegrationPlatform, string> = {
  NOTION: "Notion",
  LINEAR: "Linear",
  JIRA: "Jira",
  SLACK: "Slack",
  GOOGLE_CALENDAR: "Google Calendar",
  OUTLOOK_CALENDAR: "Outlook Calendar",
  GOOGLE_DOCS: "Google Docs",
};

// Map WorkflowOutputType to OutputType
function mapOutputType(workflowType: WorkflowOutputType): OutputType | null {
  switch (workflowType) {
    case "ACTION_ITEM":
      return OutputType.ACTION_ITEM;
    case "MEETING_NOTES":
      return OutputType.MEETING_NOTES;
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const user = await requireAuth();
    if (!user || !user.orgId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const outputTypeParam = searchParams.get("outputType") as WorkflowOutputType | null;

    // Get user's connected integrations
    const connections = await getUserConnections(user.id);

    // Get all platforms that could potentially be destinations
    const allPlatforms: IntegrationPlatform[] = [
      "NOTION",
      "LINEAR",
      "JIRA",
      "SLACK",
    ];

    // Determine which platforms are compatible with the output type
    let compatiblePlatforms: IntegrationPlatform[] = allPlatforms;
    if (outputTypeParam) {
      const outputType = mapOutputType(outputTypeParam);
      if (outputType) {
        compatiblePlatforms = OUTPUT_COMPATIBILITY[outputType] || [];
      }
    }

    // Build destination list
    const destinations = await Promise.all(
      allPlatforms.map(async (platform) => {
        const connection = connections.find((c) => c.platform === platform);
        const isConnected = !!connection && connection.status === "ACTIVE";
        const isConfigured = isPlatformConfigured(platform);
        const isEnabled = await isWorkflowPlatformEnabled(
          user.orgId!,
          platform as "LINEAR" | "NOTION" | "JIRA" | "SLACK"
        );
        const supportsOutputType = compatiblePlatforms.includes(platform);

        // Get default destination config if available
        let defaultDestination = null;
        if (connection?.config) {
          const config = connection.config as Record<string, unknown>;
          if (config.projectId || config.databaseId || config.channelId) {
            defaultDestination = {
              id: (config.projectId || config.databaseId || config.channelId) as string,
              name: (config.projectName || config.databaseName || config.channelName || "Default") as string,
            };
          }
        }

        return {
          platform,
          displayName: PLATFORM_DISPLAY_NAMES[platform],
          accountName: connection?.externalUserName || null,
          iconUrl: null, // Could add platform icons here
          isConnected,
          isConfigured,
          isEnabled,
          supportsOutputType,
          defaultDestination,
        };
      })
    );

    // Sort: connected first, then by name
    destinations.sort((a, b) => {
      if (a.isConnected !== b.isConnected) {
        return a.isConnected ? -1 : 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({
      destinations,
      outputType: outputTypeParam,
    });
  } catch (error) {
    console.error("Failed to fetch destinations:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch destinations",
        },
      },
      { status: 500 }
    );
  }
}
