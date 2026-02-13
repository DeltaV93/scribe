import { NextRequest, NextResponse } from "next/server";
import { updateCallStatus } from "@/lib/services/calls";
import { CallStatus } from "@prisma/client";
import { validateTwilioWebhook } from "@/lib/twilio/validation";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /api/webhooks/twilio/dial-status - Handle dial completion
 * Called when the <Dial> verb completes (client answers, busy, no-answer, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    const formData = await request.formData();
    const dialCallStatus = formData.get("DialCallStatus") as string;
    const dialCallDuration = formData.get("DialCallDuration") as string;

    console.log(`[Dial Status] callId=${callId}, status=${dialCallStatus}, duration=${dialCallDuration}`);

    // Validate webhook signature unless explicitly skipped
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
        console.warn("[SECURITY] Twilio dial-status webhook validation failed");
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    // Update call status based on dial result
    if (callId) {
      switch (dialCallStatus) {
        case "completed":
          // Call answered and completed normally
          await updateCallStatus(callId, CallStatus.COMPLETED);
          break;
        case "busy":
        case "no-answer":
        case "failed":
        case "canceled":
          await updateCallStatus(callId, CallStatus.FAILED);
          break;
      }
    }

    // Return empty TwiML - call is done
    const response = new VoiceResponse();
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error handling dial status webhook:", error);
    const response = new VoiceResponse();
    return new NextResponse(response.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
