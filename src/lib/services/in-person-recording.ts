/**
 * In-Person Recording Service (PX-703)
 *
 * Handles browser-based audio recording for 1:1 client meetings,
 * with the same transcription and extraction pipeline as phone calls.
 */

import { prisma } from "@/lib/db";
import { ConsentMethod, ProcessingStatus } from "@prisma/client";
import {
  transcribeFromUrl,
  transcribeFromBuffer,
  type TranscriptSegment,
} from "@/lib/deepgram/transcribe";
import {
  extractFromCallTranscript,
  type FieldDomain,
} from "@/lib/ai/call-extraction";
import {
  calculateAllConfidenceScores,
} from "@/lib/ai/confidence";
import {
  uploadRecording as uploadToS3,
  getSignedRecordingUrl,
  downloadRecording,
  isS3Configured,
  getS3Client,
  getBucketName,
} from "@/lib/storage/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isDeepgramConfigured } from "@/lib/deepgram/client";
import { AuditLogger } from "@/lib/audit/service";
import type { ExtractableField } from "@/lib/ai/types";

// ============================================
// TYPES
// ============================================

export interface CreateRecordingInput {
  organizationId: string;
  clientId: string;
  userId: string;
  consentMethod: ConsentMethod;
  consentSignature?: string; // Base64 signature for DIGITAL
  consentDocumentId?: string; // Reference for PRE_SIGNED
  formIds?: string[];
}

export interface UploadRecordingInput {
  recordingId: string;
  audioBuffer: Buffer;
  mimeType?: string;
  duration?: number;
}

export interface ProcessingResult {
  success: boolean;
  recordingId: string;
  transcript?: string;
  extractedFields?: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  error?: string;
}

export interface RecordingWithDetails {
  id: string;
  organizationId: string;
  clientId: string;
  userId: string;
  recordingUrl: string | null;
  duration: number | null;
  transcriptText: string | null;
  extractedData: Record<string, unknown> | null;
  confidenceScores: Record<string, number> | null;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  processedAt: Date | null;
  consentMethod: ConsentMethod;
  consentRecordedAt: Date;
  consentSignature: string | null;
  consentDocumentId: string | null;
  formIds: string[];
  createdAt: Date;
  updatedAt: Date;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================
// S3 KEY GENERATION
// ============================================

/**
 * Generate S3 key for in-person recording
 * Format: in-person/{orgId}/{year}/{month}/{recordingId}.webm
 */
export function getInPersonRecordingKey(
  orgId: string,
  recordingId: string,
  extension: string = "webm"
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `in-person/${orgId}/${year}/${month}/${recordingId}.${extension}`;
}

/**
 * Generate S3 key for consent signature
 */
export function getConsentSignatureKey(
  orgId: string,
  recordingId: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `in-person/${orgId}/${year}/${month}/${recordingId}_consent.png`;
}

// ============================================
// RECORDING MANAGEMENT
// ============================================

/**
 * Create a new in-person recording record with consent
 */
export async function createRecording(
  input: CreateRecordingInput
): Promise<RecordingWithDetails> {
  // Verify client exists and belongs to org
  const client = await prisma.client.findFirst({
    where: {
      id: input.clientId,
      orgId: input.organizationId,
    },
  });

  if (!client) {
    throw new Error("Client not found or does not belong to organization");
  }

  // Check if org has in-person recording enabled
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { inPersonRecordingEnabled: true },
  });

  if (!org?.inPersonRecordingEnabled) {
    throw new Error("In-person recording is not enabled for this organization");
  }

  // Upload consent signature to S3 if provided (for DIGITAL consent)
  let consentSignatureUrl: string | null = null;
  if (input.consentMethod === "DIGITAL" && input.consentSignature) {
    if (isS3Configured()) {
      // Create a temporary ID for the signature key
      const tempId = crypto.randomUUID();
      consentSignatureUrl = await uploadConsentSignature(
        input.organizationId,
        tempId,
        input.consentSignature
      );
    }
  }

  // Create the recording record
  const recording = await prisma.inPersonRecording.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      userId: input.userId,
      consentMethod: input.consentMethod,
      consentRecordedAt: new Date(),
      consentSignature: consentSignatureUrl,
      consentDocumentId: input.consentDocumentId,
      formIds: input.formIds || [],
      processingStatus: ProcessingStatus.PENDING,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // If we uploaded signature with temp ID, update with real recording ID
  if (consentSignatureUrl && input.consentSignature) {
    const newSignatureKey = getConsentSignatureKey(
      input.organizationId,
      recording.id
    );
    await prisma.inPersonRecording.update({
      where: { id: recording.id },
      data: { consentSignature: newSignatureKey },
    });
  }

  // Audit log
  await AuditLogger.inPersonRecordingCreated(
    input.organizationId,
    input.userId,
    recording.id,
    input.clientId,
    input.consentMethod
  );

  return {
    ...recording,
    extractedData: recording.extractedData as Record<string, unknown> | null,
    confidenceScores: recording.confidenceScores as Record<string, number> | null,
  };
}

/**
 * Upload consent signature to S3
 */
async function uploadConsentSignature(
  orgId: string,
  recordingId: string,
  base64Signature: string
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const key = getConsentSignatureKey(orgId, recordingId);

  // Remove data URL prefix if present
  const base64Data = base64Signature.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      Metadata: {
        "recording-id": recordingId,
        "org-id": orgId,
        type: "consent-signature",
      },
    })
  );

  return key;
}

/**
 * Upload recording audio to S3
 */
export async function uploadRecording(
  input: UploadRecordingInput
): Promise<{ success: boolean; recordingUrl?: string; error?: string }> {
  const recording = await prisma.inPersonRecording.findUnique({
    where: { id: input.recordingId },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      userId: true,
    },
  });

  if (!recording) {
    return { success: false, error: "Recording not found" };
  }

  if (!isS3Configured()) {
    return { success: false, error: "S3 is not configured" };
  }

  try {
    const client = getS3Client();
    const bucket = getBucketName();
    const key = getInPersonRecordingKey(recording.organizationId, recording.id);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.audioBuffer,
        ContentType: input.mimeType || "audio/webm",
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
        Metadata: {
          "recording-id": recording.id,
          "org-id": recording.organizationId,
          "client-id": recording.clientId,
          "user-id": recording.userId,
          "upload-time": new Date().toISOString(),
        },
      })
    );

    // Update recording with URL and duration
    await prisma.inPersonRecording.update({
      where: { id: input.recordingId },
      data: {
        recordingUrl: key,
        duration: input.duration,
      },
    });

    return { success: true, recordingUrl: key };
  } catch (error) {
    console.error("[InPersonRecording] Error uploading recording:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Process recording: transcribe and extract data
 */
export async function processRecording(
  recordingId: string
): Promise<ProcessingResult> {
  console.log(`[InPersonRecording] Starting processing for ${recordingId}`);

  try {
    // Update status to processing
    await prisma.inPersonRecording.update({
      where: { id: recordingId },
      data: { processingStatus: ProcessingStatus.PROCESSING },
    });

    // Fetch recording with client info
    const recording = await prisma.inPersonRecording.findUnique({
      where: { id: recordingId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            orgId: true,
          },
        },
        user: {
          select: { id: true },
        },
      },
    });

    if (!recording) {
      throw new Error("Recording not found");
    }

    if (!recording.recordingUrl) {
      throw new Error("No recording URL available");
    }

    // Transcribe the recording
    console.log(`[InPersonRecording] Transcribing recording`);
    const transcription = await transcribeInPersonRecording(recording.recordingUrl);

    // Get form fields to extract
    const fields = await getFormFieldsForExtraction(recording.formIds);

    // Extract fields from transcript
    let extractedFields: Record<string, unknown> = {};
    let confidenceScores: Record<string, number> = {};

    if (fields.length > 0 && transcription.segments.length > 0) {
      console.log(`[InPersonRecording] Extracting ${fields.length} fields`);

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

    // Save results
    await prisma.inPersonRecording.update({
      where: { id: recordingId },
      data: {
        transcriptText: transcription.raw,
        extractedData: extractedFields as object,
        confidenceScores: confidenceScores as object,
        processingStatus: ProcessingStatus.COMPLETED,
        processingError: null,
        processedAt: new Date(),
      },
    });

    // Audit log
    await AuditLogger.inPersonRecordingProcessed(
      recording.organizationId,
      recording.user.id,
      recordingId,
      recording.client.id
    );

    console.log(`[InPersonRecording] Successfully processed ${recordingId}`);

    return {
      success: true,
      recordingId,
      transcript: transcription.raw,
      extractedFields,
      confidenceScores,
    };
  } catch (error) {
    console.error(`[InPersonRecording] Error processing ${recordingId}:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await prisma.inPersonRecording.update({
      where: { id: recordingId },
      data: {
        processingStatus: ProcessingStatus.FAILED,
        processingError: errorMessage,
      },
    });

    return {
      success: false,
      recordingId,
      error: errorMessage,
    };
  }
}

/**
 * Transcribe in-person recording from S3
 */
async function transcribeInPersonRecording(
  source: string
): Promise<{ raw: string; segments: TranscriptSegment[] }> {
  if (!isDeepgramConfigured()) {
    throw new Error("Deepgram is not configured");
  }

  // Source is S3 key - download and transcribe from buffer
  if (source.startsWith("in-person/")) {
    const buffer = await downloadRecording(source);
    return transcribeFromBuffer(buffer, "audio/webm");
  } else {
    // Direct URL (unlikely for in-person, but supported)
    return transcribeFromUrl(source);
  }
}

/**
 * Get form fields for extraction
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

// ============================================
// RETRIEVAL
// ============================================

/**
 * Get recording by ID
 */
export async function getRecordingById(
  recordingId: string,
  orgId: string
): Promise<RecordingWithDetails | null> {
  const recording = await prisma.inPersonRecording.findFirst({
    where: {
      id: recordingId,
      organizationId: orgId,
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!recording) return null;

  return {
    ...recording,
    extractedData: recording.extractedData as Record<string, unknown> | null,
    confidenceScores: recording.confidenceScores as Record<string, number> | null,
  };
}

/**
 * Get signed URL for recording playback
 */
export async function getRecordingPlaybackUrl(
  recordingId: string,
  orgId: string
): Promise<string | null> {
  const recording = await prisma.inPersonRecording.findFirst({
    where: {
      id: recordingId,
      organizationId: orgId,
    },
    select: { recordingUrl: true },
  });

  if (!recording?.recordingUrl) return null;

  return getSignedRecordingUrl(recording.recordingUrl, 3600); // 1 hour expiry
}

/**
 * List recordings with filters
 */
export async function listRecordings(
  orgId: string,
  filters: {
    clientId?: string;
    userId?: string;
    status?: ProcessingStatus;
    startDate?: Date;
    endDate?: Date;
  },
  pagination: {
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  recordings: RecordingWithDetails[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    organizationId: orgId,
    ...(filters.clientId && { clientId: filters.clientId }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.status && { processingStatus: filters.status }),
    ...(filters.startDate || filters.endDate
      ? {
          createdAt: {
            ...(filters.startDate && { gte: filters.startDate }),
            ...(filters.endDate && { lte: filters.endDate }),
          },
        }
      : {}),
  };

  const [recordings, total] = await Promise.all([
    prisma.inPersonRecording.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.inPersonRecording.count({ where }),
  ]);

  return {
    recordings: recordings.map((r) => ({
      ...r,
      extractedData: r.extractedData as Record<string, unknown> | null,
      confidenceScores: r.confidenceScores as Record<string, number> | null,
    })),
    total,
    page,
    limit,
  };
}

/**
 * List recordings for a specific client
 */
export async function listRecordingsForClient(
  clientId: string,
  orgId: string,
  pagination: { page?: number; limit?: number } = {}
): Promise<{
  recordings: RecordingWithDetails[];
  total: number;
  page: number;
  limit: number;
}> {
  return listRecordings(orgId, { clientId }, pagination);
}

/**
 * List recordings for a specific user (case manager)
 */
export async function listRecordingsForUser(
  userId: string,
  orgId: string,
  pagination: { page?: number; limit?: number } = {}
): Promise<{
  recordings: RecordingWithDetails[];
  total: number;
  page: number;
  limit: number;
}> {
  return listRecordings(orgId, { userId }, pagination);
}

// ============================================
// RE-EXTRACTION
// ============================================

/**
 * Re-extract fields for a recording (without re-transcribing)
 */
export async function reExtractRecordingFields(
  recordingId: string,
  formIds?: string[]
): Promise<ProcessingResult> {
  try {
    const recording = await prisma.inPersonRecording.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        organizationId: true,
        clientId: true,
        userId: true,
        transcriptText: true,
        formIds: true,
      },
    });

    if (!recording || !recording.transcriptText) {
      throw new Error("Recording or transcript not found");
    }

    // Parse transcript back to segments (simplified - just use raw text)
    const segments: TranscriptSegment[] = [
      {
        speaker: "CLIENT",
        text: recording.transcriptText,
        startTime: 0,
        endTime: 0,
        confidence: 1,
        words: [],
      },
    ];

    const targetFormIds = formIds || recording.formIds;
    const fields = await getFormFieldsForExtraction(targetFormIds);

    if (fields.length === 0) {
      return {
        success: true,
        recordingId,
        extractedFields: {},
        confidenceScores: {},
      };
    }

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

    // Update recording
    await prisma.inPersonRecording.update({
      where: { id: recordingId },
      data: {
        extractedData: extractedFields as object,
        confidenceScores: confidenceScores as object,
        formIds: targetFormIds,
      },
    });

    return {
      success: true,
      recordingId,
      extractedFields,
      confidenceScores,
    };
  } catch (error) {
    return {
      success: false,
      recordingId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
