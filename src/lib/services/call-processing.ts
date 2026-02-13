import { prisma } from "@/lib/db";
import { ProcessingStatus } from "@prisma/client";
import {
  transcribeFromUrl,
  transcribeFromBuffer,
  formatTranscriptAsText,
  type TranscriptSegment,
} from "@/lib/deepgram/transcribe";
import {
  extractFromCallTranscript,
  type FieldDomain,
} from "@/lib/ai/call-extraction";
import {
  calculateAllConfidenceScores,
  summarizeConfidence,
  type ConfidenceBreakdown,
} from "@/lib/ai/confidence";
import { generateCallSummary, type CallSummary } from "@/lib/ai/summary";
import {
  transferRecordingToS3,
  downloadRecording,
  isS3Configured,
} from "@/lib/storage/s3";
import { isDeepgramConfigured } from "@/lib/deepgram/client";
import { getTwilioConfig } from "@/lib/twilio/client";
import type { ExtractableField } from "@/lib/ai/types";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

interface ProcessingResult {
  success: boolean;
  callId: string;
  transcript?: {
    raw: string;
    segments: TranscriptSegment[];
  };
  extractedFields?: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  summary?: CallSummary;
  error?: string;
}

interface CallWithClient {
  id: string;
  clientId: string;
  formIds: string[];
  recordingUrl: string | null;
  durationSeconds: number | null;
  aiProcessingRetries: number;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    orgId: string;
  };
}

/**
 * Main entry point: Process a completed call
 * This is called after a call ends to transcribe, extract, and summarize
 */
export async function processCompletedCall(
  callId: string
): Promise<ProcessingResult> {
  console.log(`[CallProcessing] Starting processing for call ${callId}`);

  try {
    // Update status to processing
    await updateProcessingStatus(callId, ProcessingStatus.PROCESSING);

    // Fetch call with client info
    const call = await getCallForProcessing(callId);
    if (!call) {
      throw new Error("Call not found");
    }

    if (!call.recordingUrl) {
      throw new Error("No recording URL available");
    }

    // Step 1: Transfer recording to S3 (if configured)
    let recordingSource = call.recordingUrl;
    if (isS3Configured()) {
      console.log(`[CallProcessing] Transferring recording to S3`);
      const s3Key = await transferRecordingToS3(
        call.recordingUrl,
        call.client.orgId,
        callId
      );
      // Update call with S3 key
      await prisma.call.update({
        where: { id: callId },
        data: { recordingUrl: s3Key },
      });
      recordingSource = s3Key;
    }

    // Step 2: Transcribe the recording
    console.log(`[CallProcessing] Transcribing recording`);
    const transcription = await transcribeRecording(recordingSource);

    // Save transcript
    await prisma.call.update({
      where: { id: callId },
      data: {
        transcriptRaw: transcription.raw,
        transcriptJson: transcription.segments as unknown as object,
      },
    });

    // Step 3: Get form fields to extract
    const fields = await getFormFieldsForExtraction(call.formIds);

    // Step 4: Extract fields from transcript
    console.log(`[CallProcessing] Extracting ${fields.length} fields`);
    let extractedFields: Record<string, unknown> = {};
    let confidenceScores: Record<string, number> = {};

    if (fields.length > 0) {
      const extractionResult = await extractFromCallTranscript(
        transcription.segments,
        fields
      );

      // Convert to simple key-value format
      for (const field of extractionResult.fields) {
        extractedFields[field.slug] = field.value;
      }

      // Calculate confidence scores
      const fieldTypes: Record<string, string> = {};
      for (const field of fields) {
        fieldTypes[field.slug] = field.type;
      }

      const confidenceBreakdowns = calculateAllConfidenceScores(
        extractionResult.fields,
        transcription.segments,
        fieldTypes
      );

      for (const [slug, breakdown] of Object.entries(confidenceBreakdowns)) {
        confidenceScores[slug] = breakdown.overall;
      }
    }

    // Step 5: Generate call summary
    console.log(`[CallProcessing] Generating summary`);
    const clientName = `${call.client.firstName} ${call.client.lastName}`;
    const summaryResult = await generateCallSummary(
      transcription.segments,
      clientName,
      call.durationSeconds || 0
    );

    // Step 6: Save all results
    await prisma.call.update({
      where: { id: callId },
      data: {
        extractedFields: extractedFields as object,
        confidenceScores: confidenceScores as object,
        aiSummary: summaryResult.summary as object,
        aiProcessingStatus: ProcessingStatus.COMPLETED,
        aiProcessingError: null,
      },
    });

    console.log(`[CallProcessing] Successfully processed call ${callId}`);

    return {
      success: true,
      callId,
      transcript: {
        raw: transcription.raw,
        segments: transcription.segments,
      },
      extractedFields,
      confidenceScores,
      summary: summaryResult.summary || undefined,
    };
  } catch (error) {
    console.error(`[CallProcessing] Error processing call ${callId}:`, error);

    // Get current retry count
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: { aiProcessingRetries: true },
    });

    const retries = (call?.aiProcessingRetries || 0) + 1;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Update status based on retry count
    await prisma.call.update({
      where: { id: callId },
      data: {
        aiProcessingStatus:
          retries >= MAX_RETRIES
            ? ProcessingStatus.FAILED
            : ProcessingStatus.QUEUED_FOR_RETRY,
        aiProcessingError: errorMessage,
        aiProcessingRetries: retries,
      },
    });

    return {
      success: false,
      callId,
      error: errorMessage,
    };
  }
}

/**
 * Transcribe a recording from URL or S3 key
 */
async function transcribeRecording(
  source: string
): Promise<{ raw: string; segments: TranscriptSegment[] }> {
  if (!isDeepgramConfigured()) {
    throw new Error("Deepgram is not configured");
  }

  // Check if source is S3 key or URL
  if (source.startsWith("recordings/")) {
    // S3 key - download and transcribe from buffer
    const buffer = await downloadRecording(source);
    return transcribeFromBuffer(buffer);
  } else if (source.includes("api.twilio.com")) {
    // Twilio URL - requires authentication to download
    console.log(`[CallProcessing] Downloading Twilio recording with auth`);
    const buffer = await downloadTwilioRecording(source);
    return transcribeFromBuffer(buffer, "audio/mpeg");
  } else {
    // Direct URL (public)
    return transcribeFromUrl(source);
  }
}

/**
 * Download a recording from Twilio with authentication
 */
async function downloadTwilioRecording(url: string): Promise<Buffer> {
  const { accountSid, authToken } = getTwilioConfig();

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${authHeader}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Twilio recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get call with client info for processing
 */
async function getCallForProcessing(
  callId: string
): Promise<CallWithClient | null> {
  return prisma.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      clientId: true,
      formIds: true,
      recordingUrl: true,
      durationSeconds: true,
      aiProcessingRetries: true,
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          orgId: true,
        },
      },
    },
  });
}

/**
 * Get form fields for the selected forms
 */
async function getFormFieldsForExtraction(
  formIds: string[]
): Promise<ExtractableField[]> {
  if (formIds.length === 0) return [];

  const forms = await prisma.form.findMany({
    where: { id: { in: formIds } },
    select: {
      fields: {
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          purpose: true,
          helpText: true,
          isRequired: true,
          options: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  const fields: ExtractableField[] = [];
  for (const form of forms) {
    for (const field of form.fields) {
      fields.push({
        id: field.id,
        slug: field.slug,
        name: field.name,
        type: field.type,
        purpose: field.purpose || "",
        helpText: field.helpText,
        isRequired: field.isRequired,
        options: field.options as { value: string; label: string }[] | null,
      });
    }
  }

  return fields;
}

/**
 * Update processing status
 */
async function updateProcessingStatus(
  callId: string,
  status: ProcessingStatus
): Promise<void> {
  await prisma.call.update({
    where: { id: callId },
    data: { aiProcessingStatus: status },
  });
}

/**
 * Process all calls pending processing (for background job)
 */
export async function processAllPendingCalls(): Promise<{
  processed: number;
  failed: number;
  errors: Array<{ callId: string; error: string }>;
}> {
  const pendingCalls = await prisma.call.findMany({
    where: {
      aiProcessingStatus: {
        in: [ProcessingStatus.PENDING, ProcessingStatus.QUEUED_FOR_RETRY],
      },
      recordingUrl: { not: null },
    },
    select: { id: true },
    take: 10, // Process in batches
    orderBy: { endedAt: "asc" },
  });

  let processed = 0;
  let failed = 0;
  const errors: Array<{ callId: string; error: string }> = [];

  for (const call of pendingCalls) {
    const result = await processCompletedCall(call.id);
    if (result.success) {
      processed++;
    } else {
      failed++;
      errors.push({ callId: call.id, error: result.error || "Unknown error" });
    }

    // Small delay between calls to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { processed, failed, errors };
}

/**
 * Retry failed call processing
 */
export async function retryFailedCall(callId: string): Promise<ProcessingResult> {
  // Reset retry count before processing
  await prisma.call.update({
    where: { id: callId },
    data: {
      aiProcessingStatus: ProcessingStatus.PENDING,
      aiProcessingRetries: 0,
      aiProcessingError: null,
    },
  });

  return processCompletedCall(callId);
}

/**
 * Re-extract fields for a call (without re-transcribing)
 */
export async function reExtractCallFields(
  callId: string,
  formIds?: string[]
): Promise<ProcessingResult> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        transcriptJson: true,
        formIds: true,
        durationSeconds: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!call || !call.transcriptJson) {
      throw new Error("Call or transcript not found");
    }

    const segments = call.transcriptJson as unknown as TranscriptSegment[];
    const targetFormIds = formIds || call.formIds;
    const fields = await getFormFieldsForExtraction(targetFormIds);

    const extractionResult = await extractFromCallTranscript(segments, fields);

    const extractedFields: Record<string, unknown> = {};
    for (const field of extractionResult.fields) {
      extractedFields[field.slug] = field.value;
    }

    const fieldTypes: Record<string, string> = {};
    for (const field of fields) {
      fieldTypes[field.slug] = field.type;
    }

    const confidenceBreakdowns = calculateAllConfidenceScores(
      extractionResult.fields,
      segments,
      fieldTypes
    );

    const confidenceScores: Record<string, number> = {};
    for (const [slug, breakdown] of Object.entries(confidenceBreakdowns)) {
      confidenceScores[slug] = breakdown.overall;
    }

    // Update call
    await prisma.call.update({
      where: { id: callId },
      data: {
        extractedFields: extractedFields as object,
        confidenceScores: confidenceScores as object,
        formIds: targetFormIds,
      },
    });

    return {
      success: true,
      callId,
      extractedFields,
      confidenceScores,
    };
  } catch (error) {
    return {
      success: false,
      callId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Regenerate summary for a call
 */
export async function regenerateCallSummary(
  callId: string
): Promise<ProcessingResult> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        transcriptJson: true,
        durationSeconds: true,
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!call || !call.transcriptJson) {
      throw new Error("Call or transcript not found");
    }

    const segments = call.transcriptJson as unknown as TranscriptSegment[];
    const clientName = `${call.client.firstName} ${call.client.lastName}`;

    const summaryResult = await generateCallSummary(
      segments,
      clientName,
      call.durationSeconds || 0
    );

    await prisma.call.update({
      where: { id: callId },
      data: {
        aiSummary: summaryResult.summary as object,
      },
    });

    return {
      success: true,
      callId,
      summary: summaryResult.summary || undefined,
    };
  } catch (error) {
    return {
      success: false,
      callId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
