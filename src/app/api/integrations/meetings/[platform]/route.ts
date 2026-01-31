/**
 * Single Meeting Integration API
 *
 * GET /api/integrations/meetings/[platform] - Get integration details
 * PATCH /api/integrations/meetings/[platform] - Update integration settings
 * DELETE /api/integrations/meetings/[platform] - Disconnect integration
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import { requireAuth, isAdmin } from "@/lib/auth";
import {
  getIntegration,
  updateIntegrationSettings,
  disconnectIntegration,
} from "@/lib/services/meetings/integrations";

interface RouteParams {
  params: Promise<{
    platform: string;
  }>;
}

/**
 * Parse and validate platform parameter
 */
function parsePlatform(platformParam: string): MeetingPlatform | null {
  const normalized = platformParam.toUpperCase().replace("-", "_");
  if (Object.values(MeetingPlatform).includes(normalized as MeetingPlatform)) {
    return normalized as MeetingPlatform;
  }
  return null;
}

/**
 * GET /api/integrations/meetings/[platform]
 * Get details for a specific integration
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const resolvedParams = await params;
    const platform = parsePlatform(resolvedParams.platform);

    if (!platform) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid platform. Must be teams, zoom, or google-meet",
          },
        },
        { status: 400 }
      );
    }

    const integration = await getIntegration(user.orgId, platform);

    if (!integration) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        platform: integration.platform,
        status: integration.status,
        autoRecordEnabled: integration.autoRecordEnabled,
        syncCalendarEnabled: integration.syncCalendarEnabled,
        settings: integration.settings,
        lastSyncAt: integration.lastSyncAt,
        lastError: integration.lastError,
        connectedAt: integration.connectedAt,
      },
    });
  } catch (error) {
    console.error("Error getting integration:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get integration" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/integrations/meetings/[platform]
 * Update integration settings
 *
 * Body:
 * - autoRecordEnabled?: boolean
 * - syncCalendarEnabled?: boolean
 * - settings?: object
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const platform = parsePlatform(resolvedParams.platform);

    if (!platform) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid platform. Must be teams, zoom, or google-meet",
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate settings
    const settings: Record<string, unknown> = {};
    if (typeof body.autoRecordEnabled === "boolean") {
      settings.autoRecordEnabled = body.autoRecordEnabled;
    }
    if (typeof body.syncCalendarEnabled === "boolean") {
      settings.syncCalendarEnabled = body.syncCalendarEnabled;
    }
    if (body.settings && typeof body.settings === "object") {
      Object.assign(settings, body.settings);
    }

    const integration = await updateIntegrationSettings(
      user.orgId,
      platform,
      settings
    );

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        platform: integration.platform,
        status: integration.status,
        autoRecordEnabled: integration.autoRecordEnabled,
        syncCalendarEnabled: integration.syncCalendarEnabled,
        settings: integration.settings,
      },
    });
  } catch (error) {
    console.error("Error updating integration:", error);

    // Check for not found error
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update integration" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/meetings/[platform]
 * Disconnect an integration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const platform = parsePlatform(resolvedParams.platform);

    if (!platform) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid platform. Must be teams, zoom, or google-meet",
          },
        },
        { status: 400 }
      );
    }

    await disconnectIntegration(user.orgId, platform);

    return NextResponse.json({
      success: true,
      message: `${platform} integration disconnected`,
    });
  } catch (error) {
    console.error("Error disconnecting integration:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to disconnect integration" } },
      { status: 500 }
    );
  }
}
