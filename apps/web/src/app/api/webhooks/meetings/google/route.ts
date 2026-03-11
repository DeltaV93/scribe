/**
 * Google Meet Webhook Endpoint
 *
 * POST /api/webhooks/meetings/google - Handle Google Calendar push notifications
 *
 * This endpoint receives notifications from Google Calendar when:
 * - Calendar events are created, updated, or deleted
 * - These events may contain Google Meet recordings
 *
 * Note: Google Meet doesn't have direct recording webhooks. Instead,
 * we use Calendar push notifications and then check for recordings.
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import {
  processRecordingWebhook,
  googleMeetService,
} from "@/lib/services/meetings/integrations";

/**
 * POST /api/webhooks/meetings/google
 * Handle Google Calendar push notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Get Google push notification headers
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceId = request.headers.get("x-goog-resource-id");
    const resourceState = request.headers.get("x-goog-resource-state");
    const channelToken = request.headers.get("x-goog-channel-token");
    const channelExpiration = request.headers.get("x-goog-channel-expiration");
    const messageNumber = request.headers.get("x-goog-message-number");

    console.log("[Google Webhook] Received push notification:", {
      channelId,
      resourceId,
      resourceState,
      messageNumber,
    });

    // Handle sync message (sent when subscription is created)
    if (resourceState === "sync") {
      console.log("[Google Webhook] Sync message received");
      return NextResponse.json(
        { success: true, message: "Sync acknowledged" },
        { status: 200 }
      );
    }

    // Parse body if present (may be empty for push notifications)
    let payload: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text) {
        payload = JSON.parse(text);
      }
    } catch {
      // Body may be empty for push notifications
    }

    // Construct notification object
    const notification = {
      kind: "calendar#channel",
      id: channelId || "",
      resourceId: resourceId || "",
      resourceUri: "",
      channelId: channelId || "",
      token: channelToken || undefined,
      expiration: channelExpiration || undefined,
      ...payload,
    };

    // Validate the webhook
    const isValid = googleMeetService.validateWebhook(
      notification,
      channelToken || undefined,
      process.env.GOOGLE_WEBHOOK_TOKEN
    );

    if (!isValid) {
      console.warn("[Google Webhook] Invalid webhook");
      return NextResponse.json(
        { error: "Invalid webhook" },
        { status: 401 }
      );
    }

    // Check for relevant events (exists = created/updated)
    const relevantStates = ["exists", "update"];
    if (!relevantStates.includes(resourceState || "")) {
      console.log(`[Google Webhook] Ignoring resource state: ${resourceState}`);
      return NextResponse.json(
        { success: true, message: "Event ignored" },
        { status: 200 }
      );
    }

    // Process the notification
    // Note: Google push notifications don't contain the actual data
    // We need to fetch the updated events
    const result = await processRecordingWebhook(
      MeetingPlatform.GOOGLE_MEET,
      notification,
      channelToken || undefined
    );

    if (result.processed) {
      console.log(`[Google Webhook] Successfully processed, meeting ID: ${result.meetingId}`);
    } else {
      console.log("[Google Webhook] Event not processed");
    }

    // Always respond with 200 OK for Google push notifications
    return NextResponse.json(
      { success: true, processed: result.processed },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Google Webhook] Error processing webhook:", error);

    // Still return 200 to prevent Google from retrying
    // Log error for investigation
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhooks/meetings/google
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    platform: "google_meet",
    endpoint: "/api/webhooks/meetings/google",
  });
}
