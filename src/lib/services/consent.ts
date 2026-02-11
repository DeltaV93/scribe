/**
 * Consent Management Service (PX-735)
 * Handles client recording consent and opt-out management
 */

import { prisma } from "@/lib/db";
import {
  ConsentType,
  ConsentStatus,
  ConsentCollectionMethod,
  Prisma,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit/service";

export interface ConsentGrantParams {
  clientId: string;
  consentType: ConsentType;
  method: ConsentCollectionMethod;
  callId?: string;
}

export interface ConsentRevokeParams {
  clientId: string;
  consentType: ConsentType;
  revokedById: string;
  reason?: string;
}

export interface ConsentStatusResult {
  hasConsent: boolean;
  status: ConsentStatus;
  grantedAt: Date | null;
  method: ConsentCollectionMethod | null;
}

const RETENTION_DAYS = 30; // 30-day soft delete retention

/**
 * Grant consent for a client
 */
export async function grantConsent(params: ConsentGrantParams): Promise<void> {
  const { clientId, consentType, method, callId } = params;

  // Upsert consent record
  await prisma.consentRecord.upsert({
    where: {
      clientId_consentType: {
        clientId,
        consentType,
      },
    },
    create: {
      clientId,
      consentType,
      status: ConsentStatus.GRANTED,
      grantedAt: new Date(),
      method,
      callId,
    },
    update: {
      status: ConsentStatus.GRANTED,
      grantedAt: new Date(),
      method,
      callId,
      revokedAt: null,
      revokedById: null,
      retentionUntil: null,
    },
  });

  // Get client's org for audit logging
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (client) {
    await createAuditLog({
      orgId: client.orgId,
      userId: "system", // Consent granted via automated system
      action: "CREATE",
      resource: "CLIENT",
      resourceId: clientId,
      details: {
        type: "consent_granted",
        consentType,
        method,
        callId,
      },
    });
  }
}

/**
 * Revoke consent for a client
 * Sets up soft delete with 30-day retention
 */
export async function revokeConsent(params: ConsentRevokeParams): Promise<void> {
  const { clientId, consentType, revokedById, reason } = params;

  const retentionUntil = new Date();
  retentionUntil.setDate(retentionUntil.getDate() + RETENTION_DAYS);

  await prisma.consentRecord.update({
    where: {
      clientId_consentType: {
        clientId,
        consentType,
      },
    },
    data: {
      status: ConsentStatus.REVOKED,
      revokedAt: new Date(),
      revokedById,
      retentionUntil,
    },
  });

  // Get client's org for audit logging
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { orgId: true },
  });

  if (client) {
    await createAuditLog({
      orgId: client.orgId,
      userId: revokedById,
      action: "DELETE",
      resource: "CLIENT",
      resourceId: clientId,
      details: {
        type: "consent_revoked",
        consentType,
        reason,
        retentionUntil: retentionUntil.toISOString(),
      },
    });
  }
}

/**
 * Get consent status for a client
 */
export async function getConsentStatus(
  clientId: string,
  consentType: ConsentType
): Promise<ConsentStatusResult> {
  const record = await prisma.consentRecord.findUnique({
    where: {
      clientId_consentType: {
        clientId,
        consentType,
      },
    },
  });

  if (!record) {
    return {
      hasConsent: false,
      status: ConsentStatus.PENDING,
      grantedAt: null,
      method: null,
    };
  }

  return {
    hasConsent: record.status === ConsentStatus.GRANTED,
    status: record.status,
    grantedAt: record.grantedAt,
    method: record.method,
  };
}

/**
 * Get all consent records for a client
 */
export async function getAllConsentRecords(clientId: string) {
  return prisma.consentRecord.findMany({
    where: { clientId },
    include: {
      revokedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Check if a client can be recorded
 * Returns true if recording consent is granted
 */
export async function canRecordClient(clientId: string): Promise<boolean> {
  const status = await getConsentStatus(clientId, ConsentType.RECORDING);
  return status.hasConsent;
}

/**
 * Mark recordings for deletion after consent revocation
 * Called by the revocation process
 */
export async function markRecordingsForDeletion(
  clientId: string,
  revokedById: string
): Promise<number> {
  // Get all calls with recordings for this client
  const calls = await prisma.call.findMany({
    where: {
      clientId,
      recordingUrl: { not: null },
    },
    select: { id: true, recordingUrl: true },
  });

  // In a real implementation, we would:
  // 1. Update call records to mark for deletion
  // 2. Queue S3 deletion jobs with retention delay
  // For now, just return count
  return calls.length;
}

/**
 * Purge expired consent records and associated recordings
 * Should be called by a scheduled job
 */
export async function purgeExpiredRecordings(): Promise<{
  recordsPurged: number;
  recordingsDeleted: number;
}> {
  const now = new Date();

  // Find consent records past retention period
  const expiredRecords = await prisma.consentRecord.findMany({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { lte: now },
    },
    include: {
      client: {
        include: {
          calls: {
            where: { recordingUrl: { not: null } },
            select: { id: true, recordingUrl: true },
          },
        },
      },
    },
  });

  let recordingsDeleted = 0;

  for (const record of expiredRecords) {
    // Delete recordings from S3 (implementation depends on S3 service)
    // await deleteS3Objects(record.client.calls.map(c => c.recordingUrl));
    recordingsDeleted += record.client.calls.length;

    // Nullify recording URLs and transcripts in call records
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
  }

  // Delete the consent records
  const deleted = await prisma.consentRecord.deleteMany({
    where: {
      status: ConsentStatus.REVOKED,
      retentionUntil: { lte: now },
    },
  });

  return {
    recordsPurged: deleted.count,
    recordingsDeleted,
  };
}
