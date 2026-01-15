import { NextRequest, NextResponse } from "next/server";
import { saveRecordingInfo } from "@/lib/services/calls";
import { validateTwilioWebhook } from "@/lib/twilio/validation";
import { prisma } from "@/lib/db";
import { processCompletedCall } from "@/lib/services/call-processing";
import { transferRecordingToS3, isS3Configured } from "@/lib/storage/s3";

/**
 * POST /api/webhooks/twilio/recording - Handle recording completion
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");
    const orgId = searchParams.get("orgId");

    if (!callId) {
      return new NextResponse("Missing callId", { status: 400 });
    }

    // Get form data from Twilio
    const formData = await request.formData();
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;

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

    // Only process completed recordings
    if (recordingStatus !== "completed") {
      return new NextResponse("OK", { status: 200 });
    }

    // Get org's recording retention days
    let retentionDays = 365;
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { recordingRetentionDays: true },
      });
      if (org?.recordingRetentionDays) {
        retentionDays = org.recordingRetentionDays;
      }
    }

    // Store the recording URL (with .mp3 extension for audio format)
    const fullRecordingUrl = `${recordingUrl}.mp3`;

    // Save recording info first
    await saveRecordingInfo(callId, fullRecordingUrl, retentionDays);

    console.log(
      `Recording saved for call ${callId}: ${recordingSid}, duration: ${recordingDuration}s`
    );

    // Transfer to S3 if configured (for HIPAA compliance)
    if (isS3Configured() && orgId) {
      try {
        console.log(`Transferring recording to S3 for call ${callId}`);
        const s3Key = await transferRecordingToS3(fullRecordingUrl, orgId, callId);

        // Update call with S3 key
        await prisma.call.update({
          where: { id: callId },
          data: { recordingUrl: s3Key },
        });

        console.log(`Recording transferred to S3: ${s3Key}`);
      } catch (s3Error) {
        console.error(`Failed to transfer recording to S3:`, s3Error);
        // Continue with processing even if S3 transfer fails
      }
    }

    // Trigger AI processing asynchronously
    // Don't await - let it run in background
    processCompletedCall(callId)
      .then((result) => {
        if (result.success) {
          console.log(`AI processing completed for call ${callId}`);
        } else {
          console.error(`AI processing failed for call ${callId}:`, result.error);
        }
      })
      .catch((error) => {
        console.error(`AI processing error for call ${callId}:`, error);
      });

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Error handling recording webhook:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
