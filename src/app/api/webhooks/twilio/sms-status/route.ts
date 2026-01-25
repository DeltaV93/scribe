import { NextRequest, NextResponse } from "next/server";
import { handleSmsStatusWebhook } from "@/lib/services/sms-notifications";
import { validateTwilioWebhook } from "@/lib/twilio/validation";

/**
 * POST /api/webhooks/twilio/sms-status - Handle Twilio SMS status callbacks
 *
 * Twilio sends status updates as messages progress through delivery:
 * queued -> sent -> delivered (or failed/undelivered)
 */
export async function POST(request: NextRequest) {
  try {
    // Get form data from Twilio
    const formData = await request.formData();

    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    const errorCode = formData.get("ErrorCode") as string | null;
    const errorMessage = formData.get("ErrorMessage") as string | null;

    if (!messageSid || !messageStatus) {
      console.error("Missing required fields in SMS status webhook", {
        messageSid,
        messageStatus,
      });
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Validate webhook signature in production
    if (process.env.NODE_ENV === "production") {
      const signature = request.headers.get("x-twilio-signature") || "";
      const url = request.url;
      const params: Record<string, string> = {};
      formData.forEach((value, key) => {
        params[key] = value as string;
      });

      const isValid = validateTwilioWebhook(signature, url, params);
      if (!isValid) {
        console.error("Invalid Twilio webhook signature for SMS status");
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    // Process the status update
    await handleSmsStatusWebhook(
      messageSid,
      messageStatus,
      errorCode || undefined,
      errorMessage || undefined
    );

    // Log for monitoring
    console.log(`SMS status update: ${messageSid} -> ${messageStatus}`, {
      errorCode,
      errorMessage,
    });

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error handling SMS status webhook:", error);
    // Return 200 to prevent Twilio from retrying
    // Log the error for investigation
    return new NextResponse("OK", { status: 200 });
  }
}
