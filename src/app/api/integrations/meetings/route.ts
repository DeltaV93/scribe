/**
 * Meeting Integrations API
 *
 * GET /api/integrations/meetings - List all meeting integrations
 * POST /api/integrations/meetings - Initiate OAuth flow for a platform
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import { requireAuth, isAdmin } from "@/lib/auth";
import {
  listIntegrations,
  initiateOAuthFlow,
} from "@/lib/services/meetings/integrations";

/**
 * GET /api/integrations/meetings
 * List all meeting platform integrations for the organization
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const integrations = await listIntegrations(user.orgId);

    // Map to public response (hide sensitive data)
    const publicIntegrations = integrations.map((integration) => ({
      id: integration.id,
      platform: integration.platform,
      status: integration.status,
      autoRecordEnabled: integration.autoRecordEnabled,
      syncCalendarEnabled: integration.syncCalendarEnabled,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
      connectedAt: integration.connectedAt,
    }));

    return NextResponse.json({
      success: true,
      data: publicIntegrations,
    });
  } catch (error) {
    console.error("Error listing integrations:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list integrations" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/meetings
 * Initiate OAuth flow for a meeting platform
 *
 * Body:
 * - platform: "TEAMS" | "ZOOM" | "GOOGLE_MEET"
 * - redirectUrl?: string - URL to redirect after OAuth completion
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins can manage integrations
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate platform
    const { platform, redirectUrl } = body;
    if (!platform || !Object.values(MeetingPlatform).includes(platform)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid platform. Must be TEAMS, ZOOM, or GOOGLE_MEET",
          },
        },
        { status: 400 }
      );
    }

    // Generate OAuth URL
    const authUrl = await initiateOAuthFlow(
      user.orgId,
      user.id,
      platform as MeetingPlatform,
      redirectUrl
    );

    return NextResponse.json({
      success: true,
      data: {
        authUrl,
        platform,
      },
    });
  } catch (error) {
    console.error("Error initiating OAuth:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to initiate OAuth flow" } },
      { status: 500 }
    );
  }
}
