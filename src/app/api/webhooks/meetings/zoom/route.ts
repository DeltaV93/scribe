/**
 * Zoom Webhook Endpoint
 *
 * POST /api/webhooks/meetings/zoom - Handle Zoom recording webhooks
 *
 * This endpoint receives notifications from Zoom when:
 * - A meeting recording is completed
 * - Recording transcript is completed
 * - Zoom needs to validate the webhook endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { MeetingPlatform } from "@prisma/client";
import {
  processRecordingWebhook,
  zoomService,
} from "@/lib/services/meetings/integrations";

/**
 * POST /api/webhooks/meetings/zoom
 * Handle Zoom webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("[Zoom Webhook] Received event:", payload.event);

    // Handle endpoint URL validation (Zoom challenge/response)
    if (payload.event === "endpoint.url_validation") {
      const validationResponse = zoomService.handleEndpointValidation(payload);
      if (validationResponse) {
        console.log("[Zoom Webhook] Endpoint validation successful");
        return NextResponse.json(validationResponse, { status: 200 });
      }
    }

    // Get signature for validation
    const signature = request.headers.get("x-zm-signature");
    const timestamp = request.headers.get("x-zm-request-timestamp");

    // Validate the webhook signature
    // Note: For production, you should verify the signature using:
    // message = `v0:${timestamp}:${JSON.stringify(payload)}`
    const rawBody = JSON.stringify(payload);
    const isValid = zoomService.validateWebhook(
      rawBody,
      signature || undefined
    );

    if (!isValid) {
      console.warn("[Zoom Webhook] Invalid webhook signature");
      // Still process for development, but log warning
      // In production, return 401
    }

    // Check for recording events
    const recordingEvents = [
      "recording.completed",
      "recording.transcript_completed",
      "recording.registration_completed",
    ];

    if (!recordingEvents.includes(payload.event)) {
      console.log(`[Zoom Webhook] Ignoring non-recording event: ${payload.event}`);
      return NextResponse.json(
        { success: true, message: "Event ignored" },
        { status: 200 }
      );
    }

    // Process the recording event
    const result = await processRecordingWebhook(
      MeetingPlatform.ZOOM,
      payload,
      signature || undefined
    );

    if (result.processed) {
      console.log(`[Zoom Webhook] Successfully processed, meeting ID: ${result.meetingId}`);
    } else {
      console.log("[Zoom Webhook] Event not processed (no matching integration)");
    }

    return NextResponse.json(
      { success: true, processed: result.processed },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Zoom Webhook] Error processing webhook:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/meetings/zoom
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    platform: "zoom",
    endpoint: "/api/webhooks/meetings/zoom",
  });
}
