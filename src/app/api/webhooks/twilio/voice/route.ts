import { NextRequest, NextResponse } from "next/server";
import { generateOutboundCallTwiML } from "@/lib/twilio/call-manager";
import { updateCallStatus } from "@/lib/services/calls";
import { CallStatus } from "@prisma/client";
import { validateTwilioWebhook } from "@/lib/twilio/validation";

/**
 * POST /api/webhooks/twilio/voice - Handle Twilio voice webhook
 * This is called when Twilio needs TwiML instructions for a call
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    // Get form data from Twilio
    const formData = await request.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;

    // Validate webhook signature unless explicitly skipped for local development
    const shouldSkipValidation =
      process.env.SKIP_WEBHOOK_VALIDATION === "true" &&
      process.env.NODE_ENV === "development";

    if (!shouldSkipValidation) {
      const signature = request.headers.get("x-twilio-signature") || "";
      const url = request.url;
      const params: Record<string, string> = {};
      formData.forEach((value, key) => {
        params[key] = value as string;
      });

      const isValid = validateTwilioWebhook(signature, url, params);
      if (!isValid) {
        const ip = request.headers.get("x-forwarded-for") ||
                   request.headers.get("x-real-ip") ||
                   "unknown";
        console.warn(
          `[SECURITY] Twilio voice webhook validation failed - IP: ${ip}, URL: ${url}`
        );
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    // Update call record with Twilio SID
    if (callId) {
      await updateCallStatus(callId, CallStatus.IN_PROGRESS);
    }

    // Generate TwiML for outbound call
    // For browser-initiated calls, this connects to the destination number
    const twiml = generateOutboundCallTwiML(to, from, true);

    return new NextResponse(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("Error handling voice webhook:", error);

    // Return a TwiML response even on error
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(errorTwiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  }
}
