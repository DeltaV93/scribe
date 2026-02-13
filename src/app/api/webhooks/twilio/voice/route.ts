import { NextRequest, NextResponse } from "next/server";
import { updateCallStatus } from "@/lib/services/calls";
import { CallStatus } from "@prisma/client";
import { validateTwilioWebhook } from "@/lib/twilio/validation";
import { prisma } from "@/lib/db";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /api/webhooks/twilio/voice - Handle Twilio voice webhook
 * This is called when Twilio needs TwiML instructions for a call
 *
 * For browser-initiated calls (via Twilio Device SDK):
 * - The browser connects to Twilio
 * - This webhook tells Twilio to dial the client's phone number
 * - Audio is bridged: Browser <-> Twilio <-> Client Phone
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data from Twilio
    const formData = await request.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;
    const callIdParam = formData.get("callId") as string;

    console.log(`[Voice Webhook] Received: To=${to}, From=${from}, CallSid=${callSid}, callId=${callIdParam}`);

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

    // The "To" parameter contains the phone number passed from browser
    // The "From" will be "client:userId" for browser-initiated calls
    const isBrowserCall = from?.startsWith("client:");

    if (!isBrowserCall) {
      // This is a direct server-initiated call, just acknowledge
      const response = new VoiceResponse();
      response.say("Connecting your call.");
      return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Browser-initiated call - we need to dial out to the destination
    const phoneNumber = to;

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
      console.error("[Voice Webhook] Invalid phone number:", phoneNumber);
      const response = new VoiceResponse();
      response.say("Invalid phone number. Please try again.");
      response.hangup();
      return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Get the caller's assigned phone number from the callId
    let callerNumber = process.env.TWILIO_DEFAULT_CALLER_ID;

    if (callIdParam) {
      // Update call status
      await updateCallStatus(callIdParam, CallStatus.RINGING);

      // Get the caller's phone number from the call record
      const call = await prisma.call.findUnique({
        where: { id: callIdParam },
        include: {
          caseManager: {
            include: {
              twilioNumber: true,
            },
          },
        },
      });

      if (call?.caseManager?.twilioNumber?.phoneNumber) {
        callerNumber = call.caseManager.twilioNumber.phoneNumber;
      }

      // Update call with browser call SID
      await prisma.call.update({
        where: { id: callIdParam },
        data: { twilioCallSid: callSid },
      });
    }

    // Generate TwiML to dial the destination number
    const response = new VoiceResponse();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const dial = response.dial({
      callerId: callerNumber,
      record: "record-from-answer-dual",
      recordingStatusCallback: `${baseUrl}/api/webhooks/twilio/recording?callId=${callIdParam}`,
      recordingStatusCallbackMethod: "POST",
      action: `${baseUrl}/api/webhooks/twilio/dial-status?callId=${callIdParam}`,
    });

    dial.number(
      {
        statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${callIdParam}`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      },
      phoneNumber
    );

    console.log(`[Voice Webhook] Dialing ${phoneNumber} from ${callerNumber}`);

    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error handling voice webhook:", error);

    // Return a TwiML response even on error
    const response = new VoiceResponse();
    response.say("An error occurred. Please try again later.");
    response.hangup();

    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
