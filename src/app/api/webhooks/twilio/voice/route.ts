import { NextRequest, NextResponse } from "next/server";
import { updateCallStatus } from "@/lib/services/calls";
import { getConsentStatus } from "@/lib/services/consent";
import { CallStatus, ConsentType, ConsentStatus } from "@prisma/client";
import { validateTwilioWebhook } from "@/lib/twilio/validation";
import { prisma } from "@/lib/db";
import twilio from "twilio";
import {
  generateConsentPromptTwiML,
  generateConsentAcceptedTwiML,
  generateConsentOptedOutTwiML,
} from "@/lib/twilio/consent-twiml";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /api/webhooks/twilio/voice - Handle Twilio voice webhook
 * This is called when Twilio needs TwiML instructions for a call
 *
 * For browser-initiated calls (via Twilio Device SDK):
 * - The browser connects to Twilio
 * - Check consent status and route accordingly:
 *   - PENDING: Play consent prompt first
 *   - GRANTED: Dial with recording
 *   - REVOKED: Dial without recording
 * - Audio is bridged: Browser <-> Twilio <-> Client Phone
 */
export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    // Get form data from Twilio
    const formData = await request.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;
    const callIdParam = formData.get("callId") as string;

    console.log(
      `[Voice Webhook] Received: To=${to}, From=${from}, CallSid=${callSid}, callId=${callIdParam}`
    );

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
        const ip =
          request.headers.get("x-forwarded-for") ||
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

    // Get call record and related data
    let callerNumber = process.env.TWILIO_DEFAULT_CALLER_ID || "";
    let clientId: string | null = null;

    if (callIdParam) {
      // Update call status
      await updateCallStatus(callIdParam, CallStatus.RINGING);

      // Get the call record with client and case manager info
      const call = await prisma.call.findUnique({
        where: { id: callIdParam },
        include: {
          client: {
            select: {
              id: true,
              phone: true,
            },
          },
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

      if (call?.client?.id) {
        clientId = call.client.id;
      }

      // Update call with browser call SID
      await prisma.call.update({
        where: { id: callIdParam },
        data: { twilioCallSid: callSid },
      });
    }

    // Check consent status (PX-735)
    let consentStatus: ConsentStatus = ConsentStatus.PENDING;
    if (clientId) {
      const consent = await getConsentStatus(clientId, ConsentType.RECORDING);
      consentStatus = consent.status as ConsentStatus;
      console.log(
        `[Voice Webhook] Consent status for client ${clientId}: ${consentStatus}`
      );
    }

    // Route based on consent status
    switch (consentStatus) {
      case ConsentStatus.PENDING: {
        // No prior consent - play consent prompt
        console.log(
          `[Voice Webhook] Playing consent prompt for call ${callIdParam}`
        );

        const twiml = generateConsentPromptTwiML({
          callId: callIdParam,
          clientId: clientId || "",
          baseUrl,
        });

        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }

      case ConsentStatus.GRANTED: {
        // Consent already granted - proceed with recording
        console.log(
          `[Voice Webhook] Consent granted - dialing with recording for call ${callIdParam}`
        );

        const twiml = generateConsentAcceptedTwiML({
          callId: callIdParam,
          clientId: clientId || "",
          baseUrl,
          phoneNumber,
          callerNumber,
        });

        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }

      case ConsentStatus.REVOKED: {
        // Consent revoked - proceed WITHOUT recording
        console.log(
          `[Voice Webhook] Consent revoked - dialing WITHOUT recording for call ${callIdParam}`
        );

        const twiml = generateConsentOptedOutTwiML({
          callId: callIdParam,
          clientId: clientId || "",
          baseUrl,
          phoneNumber,
          callerNumber,
        });

        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }

      default: {
        // Fallback - treat as pending, play consent prompt
        console.log(
          `[Voice Webhook] Unknown consent status - playing consent prompt for call ${callIdParam}`
        );

        const twiml = generateConsentPromptTwiML({
          callId: callIdParam,
          clientId: clientId || "",
          baseUrl,
        });

        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }
    }
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
