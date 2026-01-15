import { NextRequest, NextResponse } from "next/server";
import { updateCallStatus, updateCall } from "@/lib/services/calls";
import { CallStatus } from "@prisma/client";
import { validateTwilioWebhook } from "@/lib/twilio/validation";

/**
 * Map Twilio call status to our CallStatus enum
 */
function mapTwilioStatus(twilioStatus: string): CallStatus | null {
  const statusMap: Record<string, CallStatus> = {
    queued: CallStatus.INITIATING,
    initiated: CallStatus.INITIATING,
    ringing: CallStatus.RINGING,
    "in-progress": CallStatus.IN_PROGRESS,
    completed: CallStatus.COMPLETED,
    busy: CallStatus.ATTEMPTED,
    "no-answer": CallStatus.ATTEMPTED,
    canceled: CallStatus.ABANDONED,
    failed: CallStatus.FAILED,
  };

  return statusMap[twilioStatus] || null;
}

/**
 * POST /api/webhooks/twilio/status - Handle Twilio status callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      return new NextResponse("Missing callId", { status: 400 });
    }

    // Get form data from Twilio
    const formData = await request.formData();
    const callStatus = formData.get("CallStatus") as string;
    const callSid = formData.get("CallSid") as string;
    const callDuration = formData.get("CallDuration") as string;

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
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    // Map and update status
    const status = mapTwilioStatus(callStatus);

    if (status) {
      const updateData: Record<string, unknown> = { status };

      // Store Twilio Call SID
      if (callSid) {
        updateData.twilioCallSid = callSid;
      }

      // If call is completed, update duration
      if (status === CallStatus.COMPLETED && callDuration) {
        updateData.durationSeconds = parseInt(callDuration);
        updateData.endedAt = new Date();
      }

      await updateCall(callId, updateData);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error handling status webhook:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
