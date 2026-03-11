/**
 * Video Meeting Bot Feature Check API
 * GET /api/features/video-meeting-bot
 *
 * Check if video meeting bot feature is enabled for current user's org
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features/flags";
import { isBotServiceConfigured } from "@/lib/meeting-bot";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { enabled: false, reason: "Not authenticated" },
      { status: 200 }
    );
  }

  try {
    // Check if feature flag is enabled for org
    const flagEnabled = await isFeatureEnabled(user.orgId, "video-meeting-bot");

    // Check if bot service is configured
    const serviceConfigured = isBotServiceConfigured();

    // Feature is only fully enabled if both conditions are met
    const enabled = flagEnabled && serviceConfigured;

    return NextResponse.json({
      enabled,
      flagEnabled,
      serviceConfigured,
      // Provide reason if not enabled
      reason: !flagEnabled
        ? "Feature not enabled for organization"
        : !serviceConfigured
        ? "Bot service not configured"
        : undefined,
    });
  } catch (error) {
    console.error("[Features] Error checking video-meeting-bot:", error);
    return NextResponse.json(
      { enabled: false, reason: "Error checking feature status" },
      { status: 200 }
    );
  }
}
