import { NextRequest, NextResponse } from "next/server";
import { validateTwilioWebhook } from "@/lib/twilio/validation";
import { prisma } from "@/lib/db";
import {
  grantConsent,
  getConsentStatus,
} from "@/lib/services/consent";
import { createInteractionMetadata } from "@/lib/services/interaction-metadata";
import {
  generateConsentAcceptedTwiML,
  generateConsentOptedOutTwiML,
  generateSpanishPromptTwiML,
  generateConsentErrorTwiML,
} from "@/lib/twilio/consent-twiml";
import {
  ConsentType,
  ConsentCollectionMethod,
  UnrecordedReason,
  CallDirection,
} from "@prisma/client";

/**
 * POST /api/webhooks/twilio/consent - Handle consent DTMF responses
 *
 * Query params:
 * - callId: Scrybe call ID
 * - clientId: Client ID
 * - lang: Language code (en/es)
 * - timeout: If "true", this is a timeout redirect
 *
 * Form data from Twilio:
 * - Digits: DTMF input (1=accept, 2=opt-out, 9=Spanish)
 * - CallSid: Twilio call SID
 */
export async function POST(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");
    const clientId = searchParams.get("clientId");
    const lang = (searchParams.get("lang") || "en") as "en" | "es";
    const isTimeout = searchParams.get("timeout") === "true";

    // Get form data from Twilio
    const formData = await request.formData();
    const digits = formData.get("Digits") as string | null;
    const callSid = formData.get("CallSid") as string;

    console.log(
      `[Consent Webhook] callId=${callId}, clientId=${clientId}, digits=${digits}, timeout=${isTimeout}, lang=${lang}`
    );

    // Validate required params
    if (!callId || !clientId) {
      console.error("[Consent Webhook] Missing callId or clientId");
      return new NextResponse(generateConsentErrorTwiML(lang), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Validate webhook signature (skip in development if configured)
    const shouldSkipValidation =
      process.env.SKIP_WEBHOOK_VALIDATION === "true" &&
      process.env.NODE_ENV === "development";

    if (!shouldSkipValidation) {
      const signature = request.headers.get("x-twilio-signature") || "";
      const params: Record<string, string> = {};
      formData.forEach((value, key) => {
        params[key] = value as string;
      });

      const isValid = validateTwilioWebhook(signature, request.url, params);
      if (!isValid) {
        console.warn(
          `[SECURITY] Consent webhook validation failed - URL: ${request.url}`
        );
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    // Get call details for dialing
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        client: true,
        caseManager: {
          include: {
            twilioNumber: true,
          },
        },
      },
    });

    if (!call) {
      console.error(`[Consent Webhook] Call not found: ${callId}`);
      return new NextResponse(generateConsentErrorTwiML(lang), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const phoneNumber = call.client.phone;
    const callerNumber =
      call.caseManager?.twilioNumber?.phoneNumber ||
      process.env.TWILIO_DEFAULT_CALLER_ID ||
      "";

    const twimlOptions = {
      callId,
      clientId,
      language: lang,
      baseUrl,
      phoneNumber,
      callerNumber,
    };

    // Handle timeout - silence implies consent per spec
    if (isTimeout) {
      console.log(`[Consent Webhook] Timeout - treating as consent for ${clientId}`);

      // Grant consent with SILENCE_TIMEOUT method
      await grantConsent({
        clientId,
        consentType: ConsentType.RECORDING,
        method: ConsentCollectionMethod.SILENCE_TIMEOUT,
        callId,
      });

      // Mark call as recorded
      await prisma.call.update({
        where: { id: callId },
        data: {
          consentGrantedAt: new Date(),
          consentMethod: ConsentCollectionMethod.SILENCE_TIMEOUT,
          isRecorded: true,
        },
      });

      return new NextResponse(generateConsentAcceptedTwiML(twimlOptions), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Handle DTMF input
    switch (digits) {
      case "1": {
        // Consent granted via keypress
        console.log(`[Consent Webhook] Consent granted via keypress for ${clientId}`);

        await grantConsent({
          clientId,
          consentType: ConsentType.RECORDING,
          method: ConsentCollectionMethod.KEYPRESS,
          callId,
        });

        // Mark call as recorded
        await prisma.call.update({
          where: { id: callId },
          data: {
            consentGrantedAt: new Date(),
            consentMethod: ConsentCollectionMethod.KEYPRESS,
            isRecorded: true,
          },
        });

        return new NextResponse(generateConsentAcceptedTwiML(twimlOptions), {
          headers: { "Content-Type": "text/xml" },
        });
      }

      case "2": {
        // Consent declined - opt out
        console.log(`[Consent Webhook] Consent declined for ${clientId}`);

        // Create interaction metadata for unrecorded call
        await createInteractionMetadata({
          clientId,
          caseManagerId: call.caseManagerId,
          orgId: call.client.orgId,
          direction: CallDirection.OUTBOUND,
          startedAt: call.startedAt,
          reason: UnrecordedReason.CLIENT_OPT_OUT,
          callId,
        });

        // Mark call as unrecorded
        await prisma.call.update({
          where: { id: callId },
          data: {
            isRecorded: false,
          },
        });

        return new NextResponse(generateConsentOptedOutTwiML(twimlOptions), {
          headers: { "Content-Type": "text/xml" },
        });
      }

      case "9": {
        // Switch to Spanish
        console.log(`[Consent Webhook] Switching to Spanish for ${clientId}`);

        return new NextResponse(
          generateSpanishPromptTwiML({
            callId,
            clientId,
            baseUrl,
          }),
          {
            headers: { "Content-Type": "text/xml" },
          }
        );
      }

      default: {
        // Invalid input - treat same as timeout (silence = consent)
        console.log(
          `[Consent Webhook] Invalid input "${digits}" - treating as consent for ${clientId}`
        );

        await grantConsent({
          clientId,
          consentType: ConsentType.RECORDING,
          method: ConsentCollectionMethod.SILENCE_TIMEOUT,
          callId,
        });

        await prisma.call.update({
          where: { id: callId },
          data: {
            consentGrantedAt: new Date(),
            consentMethod: ConsentCollectionMethod.SILENCE_TIMEOUT,
            isRecorded: true,
          },
        });

        return new NextResponse(generateConsentAcceptedTwiML(twimlOptions), {
          headers: { "Content-Type": "text/xml" },
        });
      }
    }
  } catch (error) {
    console.error("[Consent Webhook] Error:", error);

    return new NextResponse(generateConsentErrorTwiML(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
