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
 * Call types:
 * 1. Browser-initiated outbound calls (from starts with "client:"):
 *    - Check consent status and route accordingly
 *    - PENDING: Play consent prompt first
 *    - GRANTED: Dial with recording
 *    - REVOKED: Dial without recording
 *
 * 2. Inbound calls (from is a phone number, to is our Twilio number):
 *    - Per PX-735 US-5: ALWAYS play consent prompt regardless of prior status
 *    - Consent prompt captures fresh consent for each inbound interaction
 *    - Route to appropriate case manager after consent response
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

    // Determine call type based on From field
    // Browser-initiated: From starts with "client:" (e.g., "client:user-123")
    // Inbound: From is a phone number (e.g., "+14155551234")
    const isBrowserCall = from?.startsWith("client:");
    const isInboundCall = from?.startsWith("+") && !isBrowserCall;

    // Handle inbound calls (PX-735 US-5)
    if (isInboundCall) {
      return handleInboundCall(request, { from, to, callSid, baseUrl });
    }

    // Handle server-initiated calls (not browser, not inbound phone)
    if (!isBrowserCall) {
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

/**
 * Handle inbound calls (PX-735 US-5)
 *
 * Per spec: ALL inbound calls should play consent prompt regardless of prior consent.
 * This ensures fresh consent is captured for each inbound interaction.
 */
async function handleInboundCall(
  request: NextRequest,
  params: {
    from: string;
    to: string;
    callSid: string;
    baseUrl: string;
  }
): Promise<NextResponse> {
  const { from, to, callSid, baseUrl } = params;

  console.log(
    `[Voice Webhook] Inbound call from ${from} to ${to}, CallSid=${callSid}`
  );

  try {
    // Try to find the client by phone number
    const client = await prisma.client.findFirst({
      where: {
        phone: from,
      },
      select: {
        id: true,
        orgId: true,
      },
    });

    // Create a call record for inbound call
    let callId: string | undefined;
    if (client) {
      // Find an available case manager for this client's org
      const caseManager = await prisma.user.findFirst({
        where: {
          orgId: client.orgId,
          role: { in: ["CASE_MANAGER", "PROGRAM_MANAGER", "ADMIN"] },
        },
        include: {
          twilioNumber: true,
        },
      });

      if (caseManager) {
        const call = await prisma.call.create({
          data: {
            clientId: client.id,
            caseManagerId: caseManager.id,
            status: CallStatus.RINGING,
            direction: "INBOUND",
            twilioCallSid: callSid,
            startedAt: new Date(),
            isRecorded: false, // Will be updated based on consent
          },
        });
        callId = call.id;
        console.log(`[Voice Webhook] Created inbound call record: ${callId}`);
      }
    }

    // Always play consent prompt for inbound calls (per US-5)
    // This ensures fresh consent regardless of prior status
    console.log(
      `[Voice Webhook] Playing consent prompt for inbound call from ${from}`
    );

    const twiml = generateConsentPromptTwiML({
      callId: callId || `inbound-${callSid}`,
      clientId: client?.id || "",
      baseUrl,
    });

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("[Voice Webhook] Error handling inbound call:", error);

    // On error, still try to play consent prompt with minimal params
    const twiml = generateConsentPromptTwiML({
      callId: `inbound-${callSid}`,
      clientId: "",
      baseUrl,
    });

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
