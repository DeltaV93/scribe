/**
 * Recording Cleanup Service (PX-735)
 * Handles S3 recording deletion for consent revocation and retention purge
 */

import { prisma } from "@/lib/db";
import { deleteRecording, recordingExists, isS3Configured } from "@/lib/storage/s3";
import { createAuditLog } from "@/lib/audit/service";
import { ConsentStatus, Prisma } from "@prisma/client";

export interface RecordingDeletionResult {
  callId: string;
  recordingUrl: string;
  deleted: boolean;
  error?: string;
}

export interface PurgeResult {
  consentRecordsPurged: number;
  recordingsDeleted: number;
  recordingsFailed: number;
  callsProcessed: number;
  errors: string[];
}

/**
 * Extract S3 key from a recording URL
 *
 * Recording URLs can be in various formats:
 * - S3 key only: "recordings/org-123/2024/01/call-456.mp3"
 * - S3 URL: "https://bucket.s3.region.amazonaws.com/recordings/..."
 * - Presigned URL: "https://bucket.s3.region.amazonaws.com/recordings/...?X-Amz-..."
 * - Twilio URL: "https://api.twilio.com/..." (should not be stored, but handle gracefully)
 */
export function extractS3KeyFromUrl(recordingUrl: string): string | null {
  if (!recordingUrl) {
    return null;
  }

  // If it's a Twilio URL, we can't delete it via S3
  if (recordingUrl.includes("api.twilio.com")) {
    return null;
  }

  // If it starts with "recordings/", it's already a key
  if (recordingUrl.startsWith("recordings/")) {
    return recordingUrl;
  }

  // If it's an S3 URL, extract the key
  try {
    const url = new URL(recordingUrl);

    // Handle s3.amazonaws.com URLs
    if (url.hostname.includes("s3.") && url.hostname.includes("amazonaws.com")) {
      // Path starts with /bucket-name/key or just /key depending on URL style
      let path = url.pathname;

      // Remove leading slash
      if (path.startsWith("/")) {
        path = path.slice(1);
      }

      // If path contains bucket name prefix, it might be virtual-hosted style
      // For virtual-hosted: bucket.s3.region.amazonaws.com/key
      // For path-style: s3.region.amazonaws.com/bucket/key
      if (url.hostname.startsWith("s3.")) {
        // Path-style URL, first segment is bucket name
        const segments = path.split("/");
        segments.shift(); // Remove bucket name
        path = segments.join("/");
      }

      return path || null;
    }

    // Fallback: try to find recordings/ in the path
    const recordingsIndex = url.pathname.indexOf("recordings/");
    if (recordingsIndex !== -1) {
      return url.pathname.slice(recordingsIndex);
    }

    return null;
  } catch {
    // If it's not a valid URL, it might already be a key
    if (recordingUrl.includes("recordings/")) {
      const index = recordingUrl.indexOf("recordings/");
      return recordingUrl.slice(index);
    }
    return null;
  }
}

/**
 * Delete a single recording from S3
 */
export async function deleteRecordingFromS3(
  recordingUrl: string,
  options?: {
    skipAudit?: boolean;
    orgId?: string;
    userId?: string;
    callId?: string;
  }
): Promise<{ deleted: boolean; error?: string }> {
  if (!isS3Configured()) {
    return { deleted: false, error: "S3 not configured" };
  }

  const s3Key = extractS3KeyFromUrl(recordingUrl);
  if (!s3Key) {
    return {
      deleted: false,
      error: `Could not extract S3 key from URL: ${recordingUrl}`,
    };
  }

  try {
    // Check if object exists first (idempotent)
    const exists = await recordingExists(s3Key);
    if (!exists) {
      // Object already deleted or never existed - success
      return { deleted: true };
    }

    // Delete the object
    await deleteRecording(s3Key);

    // Audit log if context provided
    if (!options?.skipAudit && options?.orgId && options?.userId) {
      await createAuditLog({
        orgId: options.orgId,
        userId: options.userId,
        action: "DELETE",
        resource: "CALL",
        resourceId: options.callId || s3Key,
        details: {
          type: "recording_deleted",
          s3Key,
          reason: "consent_revoked",
        },
      });
    }

    return { deleted: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Recording Cleanup] Failed to delete ${s3Key}:`, errorMessage);
    return { deleted: false, error: errorMessage };
  }
}

/**
 * Delete all recordings for a client
 * Called when consent is revoked (immediate deletion, not retention queue)
 */
export async function deleteClientRecordings(
  clientId: string,
  revokedById: string
): Promise<RecordingDeletionResult[]> {
  // Get all calls with recordings for this client
  const calls = await prisma.call.findMany({
    where: {
      clientId,
      recordingUrl: { not: null },
    },
    select: {
      id: true,
      recordingUrl: true,
      client: {
        select: { orgId: true },
      },
    },
  });

  const results: RecordingDeletionResult[] = [];

  for (const call of calls) {
    const result = await deleteRecordingFromS3(call.recordingUrl!, {
      orgId: call.client.orgId,
      userId: revokedById,
      callId: call.id,
    });

    results.push({
      callId: call.id,
      recordingUrl: call.recordingUrl!,
      deleted: result.deleted,
      error: result.error,
    });

    // If S3 deletion succeeded, nullify the call record
    if (result.deleted) {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          recordingUrl: null,
          transcriptRaw: null,
          transcriptJson: Prisma.JsonNull,
        },
      });
    }
  }

  return results;
}

/**
 * Purge expired consent records and their associated recordings
 *
 * This should be called by a scheduled job (cron).
 * Finds all REVOKED consent records past their retention period,
 * deletes associated S3 recordings, and removes the consent records.
 */
export async function purgeExpiredRecordings(): Promise<PurgeResult> {
  const now = new Date();
  const errors: string[] = [];
  let recordingsDeleted = 0;
  let recordingsFailed = 0;
  let callsProcessed = 0;

  // Find consent records past retention period
  const expiredRecords = await prisma.consentRecord.findMany({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { lte: now },
    },
    include: {
      client: {
        select: {
          id: true,
          orgId: true,
        },
      },
    },
  });

  console.log(
    `[Recording Cleanup] Found ${expiredRecords.length} expired consent records to purge`
  );

  for (const record of expiredRecords) {
    // Get all calls with recordings for this client
    const calls = await prisma.call.findMany({
      where: {
        clientId: record.clientId,
        recordingUrl: { not: null },
      },
      select: {
        id: true,
        recordingUrl: true,
      },
    });

    callsProcessed += calls.length;

    // Delete each recording from S3
    for (const call of calls) {
      const result = await deleteRecordingFromS3(call.recordingUrl!, {
        orgId: record.client.orgId,
        userId: "system",
        callId: call.id,
      });

      if (result.deleted) {
        recordingsDeleted++;
      } else {
        recordingsFailed++;
        errors.push(`Call ${call.id}: ${result.error}`);
      }
    }

    // Nullify recording data in Call records regardless of S3 result
    // (S3 object may have been manually deleted or never existed)
    await prisma.call.updateMany({
      where: {
        clientId: record.clientId,
        recordingUrl: { not: null },
      },
      data: {
        recordingUrl: null,
        transcriptRaw: null,
        transcriptJson: Prisma.JsonNull,
      },
    });

    // Audit log the purge
    await createAuditLog({
      orgId: record.client.orgId,
      userId: "system",
      action: "DELETE",
      resource: "CLIENT",
      resourceId: record.clientId,
      details: {
        type: "consent_record_purged",
        consentType: record.consentType,
        recordingsDeleted: calls.length,
        retentionUntil: record.retentionUntil?.toISOString(),
      },
    });
  }

  // Delete the expired consent records
  const deleted = await prisma.consentRecord.deleteMany({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { lte: now },
    },
  });

  console.log(
    `[Recording Cleanup] Purged ${deleted.count} consent records, ${recordingsDeleted} recordings`
  );

  return {
    consentRecordsPurged: deleted.count,
    recordingsDeleted,
    recordingsFailed,
    callsProcessed,
    errors,
  };
}

/**
 * Get purge statistics for monitoring
 */
export async function getPurgeStats(): Promise<{
  pendingPurge: number;
  nextPurgeDate: Date | null;
}> {
  const now = new Date();

  // Count records awaiting purge
  const pendingPurge = await prisma.consentRecord.count({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { lte: now },
    },
  });

  // Get the nearest upcoming purge date
  const nextRecord = await prisma.consentRecord.findFirst({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { gt: now },
    },
    orderBy: { retentionUntil: "asc" },
    select: { retentionUntil: true },
  });

  return {
    pendingPurge,
    nextPurgeDate: nextRecord?.retentionUntil || null,
  };
}
