/**
 * Microsoft Teams Webhook Endpoint
 *
 * POST /api/webhooks/meetings/teams - Handle Teams recording webhooks
 *
 * This endpoint receives notifications from Microsoft Graph when:
 * - A meeting recording is created or updated
 * - Teams needs to validate the webhook subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import {
  processRecordingWebhook,
  teamsService,
} from "@/lib/services/meetings/integrations";

/**
 * POST /api/webhooks/meetings/teams
 * Handle Microsoft Teams Graph API notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Check for validation token (subscription validation)
    const validationToken = request.nextUrl.searchParams.get("validationToken");
    if (validationToken) {
      // Microsoft sends a validation request when subscribing
      // We must respond with the token in plain text
      console.log("[Teams Webhook] Validation request received");
      return new NextResponse(validationToken, {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    // Parse the webhook payload
    const payload = await request.json();

    console.log("[Teams Webhook] Received notification:", JSON.stringify(payload, null, 2));

    // Validate the webhook
    const isValid = teamsService.validateWebhook(payload);
    if (!isValid) {
      console.warn("[Teams Webhook] Invalid webhook payload");
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    // Process the recording event
    const result = await processRecordingWebhook(
      MeetingPlatform.TEAMS,
      payload,
      request.headers.get("x-ms-signature") || undefined
    );

    if (result.processed) {
      console.log(`[Teams Webhook] Successfully processed, meeting ID: ${result.meetingId}`);
    } else {
      console.log("[Teams Webhook] Event not processed (not a recording event or no matching integration)");
    }

    // Always respond with 202 Accepted for Graph notifications
    return NextResponse.json(
      { success: true, processed: result.processed },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Teams Webhook] Error processing webhook:", error);

    // Return 500 to trigger Graph retry
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/meetings/teams
 * Health check / validation endpoint
 */
export async function GET(request: NextRequest) {
  // Handle validation token in GET request as well
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json({
    status: "ok",
    platform: "teams",
    endpoint: "/api/webhooks/meetings/teams",
  });
}
