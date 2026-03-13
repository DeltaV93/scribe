/**
 * Meeting Bot Webhook API (PX-865)
 * POST /api/meeting-bot/webhook
 *
 * Receives status updates and recording completions from the bot service
 */

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  handleStatusWebhook,
  handleRecordingCompleted,
  type BotStatusWebhook,
  type RecordingCompletedWebhook,
} from "@/lib/meeting-bot";

// Webhook secret for verification
const WEBHOOK_SECRET = process.env.MEETING_BOT_WEBHOOK_SECRET || "";

import crypto from "crypto";

/**
 * Verify webhook signature using timing-safe comparison
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!secret) {
    // No secret configured, skip verification (development only)
    console.warn("[MeetingBot Webhook] No webhook secret configured");
    return process.env.NODE_ENV === "development";
  }

  if (!signature) {
    return false;
  }

  // HMAC verification with timing-safe comparison to prevent timing attacks
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffers have different lengths - signature invalid
    return false;
  }
}

interface WebhookPayload {
  type: "status_update" | "recording_completed";
  data: BotStatusWebhook | RecordingCompletedWebhook;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  // Get raw body for signature verification
  const rawBody = await request.text();

  // Verify webhook signature
  const headersList = await headers();
  const signature = headersList.get("x-webhook-signature");

  if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
    console.error("[MeetingBot Webhook] Invalid signature");
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
      { status: 401 }
    );
  }

  // Parse payload
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  // Validate payload structure
  if (!payload.type || !payload.data) {
    return NextResponse.json(
      { error: { code: "INVALID_PAYLOAD", message: "Missing type or data" } },
      { status: 400 }
    );
  }

  try {
    switch (payload.type) {
      case "status_update":
        await handleStatusWebhook(payload.data as BotStatusWebhook);
        console.log(
          `[MeetingBot Webhook] Status update: ${(payload.data as BotStatusWebhook).botId} -> ${(payload.data as BotStatusWebhook).status}`
        );
        break;

      case "recording_completed":
        await handleRecordingCompleted(payload.data as RecordingCompletedWebhook);
        console.log(
          `[MeetingBot Webhook] Recording completed: ${(payload.data as RecordingCompletedWebhook).botId}`
        );
        break;

      default:
        console.warn(`[MeetingBot Webhook] Unknown webhook type: ${payload.type}`);
        return NextResponse.json(
          { error: { code: "UNKNOWN_TYPE", message: `Unknown webhook type: ${payload.type}` } },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MeetingBot Webhook] Processing error:", error);
    return NextResponse.json(
      {
        error: {
          code: "PROCESSING_ERROR",
          message: "Failed to process webhook",
        },
      },
      { status: 500 }
    );
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "meeting-bot-webhook",
    timestamp: new Date().toISOString(),
  });
}
