import { prisma } from "@/lib/db";
import { createSignedEntry, verifyChain, getGenesisHash, generateIntegrityProof } from "./hash-chain";
import type {
  AuditLogEntry,
  AuditLogCreateInput,
  AuditLogFilter,
  AuditChainVerification,
  AuditAction,
  AuditResource,
} from "./types";
import type { Prisma } from "@prisma/client";

/**
 * Get the last hash in the chain for an organization
 */
async function getLastHash(orgId: string): Promise<string> {
  const lastEntry = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "desc" },
    select: { hash: true },
  });

  return lastEntry?.hash || getGenesisHash();
}

/**
 * Create a new audit log entry
 */
export async function createAuditLog(
  input: AuditLogCreateInput
): Promise<AuditLogEntry> {
  // Get the previous hash to maintain the chain
  const previousHash = await getLastHash(input.orgId);

  // Create the signed entry
  const signedEntry = createSignedEntry(input, previousHash);

  // Store in database
  const created = await prisma.auditLog.create({
    data: {
      id: signedEntry.id,
      orgId: signedEntry.orgId,
      userId: signedEntry.userId,
      action: signedEntry.action,
      resource: signedEntry.resource,
      resourceId: signedEntry.resourceId,
      resourceName: signedEntry.resourceName,
      details: signedEntry.details as Prisma.InputJsonValue,
      ipAddress: signedEntry.ipAddress,
      userAgent: signedEntry.userAgent,
      previousHash: signedEntry.previousHash,
      hash: signedEntry.hash,
      timestamp: signedEntry.timestamp,
    },
  });

  return {
    id: created.id,
    orgId: created.orgId,
    userId: created.userId,
    action: created.action as AuditAction,
    resource: created.resource as AuditResource,
    resourceId: created.resourceId,
    resourceName: created.resourceName || undefined,
    details: created.details as Record<string, unknown>,
    ipAddress: created.ipAddress || undefined,
    userAgent: created.userAgent || undefined,
    previousHash: created.previousHash,
    hash: created.hash,
    timestamp: created.timestamp,
  };
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  filter: AuditLogFilter
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const where: Prisma.AuditLogWhereInput = {
    orgId: filter.orgId,
    ...(filter.userId && { userId: filter.userId }),
    ...(filter.action && { action: filter.action }),
    ...(filter.resource && { resource: filter.resource }),
    ...(filter.resourceId && { resourceId: filter.resourceId }),
    ...(filter.startDate || filter.endDate
      ? {
          timestamp: {
            ...(filter.startDate && { gte: filter.startDate }),
            ...(filter.endDate && { lte: filter.endDate }),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    entries: entries.map((e) => ({
      id: e.id,
      orgId: e.orgId,
      userId: e.userId,
      action: e.action as AuditAction,
      resource: e.resource as AuditResource,
      resourceId: e.resourceId,
      resourceName: e.resourceName || undefined,
      details: e.details as Record<string, unknown>,
      ipAddress: e.ipAddress || undefined,
      userAgent: e.userAgent || undefined,
      previousHash: e.previousHash,
      hash: e.hash,
      timestamp: e.timestamp,
    })),
    total,
  };
}

/**
 * Verify the integrity of the audit chain
 */
export async function verifyAuditChain(
  orgId: string
): Promise<AuditChainVerification> {
  // Get all entries for the organization
  const entries = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { timestamp: "asc" },
  });

  const auditEntries: AuditLogEntry[] = entries.map((e) => ({
    id: e.id,
    orgId: e.orgId,
    userId: e.userId,
    action: e.action as AuditAction,
    resource: e.resource as AuditResource,
    resourceId: e.resourceId,
    resourceName: e.resourceName || undefined,
    details: e.details as Record<string, unknown>,
    ipAddress: e.ipAddress || undefined,
    userAgent: e.userAgent || undefined,
    previousHash: e.previousHash,
    hash: e.hash,
    timestamp: e.timestamp,
  }));

  return verifyChain(auditEntries);
}

/**
 * Get an integrity proof for a specific entry
 */
export async function getIntegrityProof(
  entryId: string,
  orgId: string
): Promise<{ proof?: string; error?: string }> {
  const entry = await prisma.auditLog.findFirst({
    where: { id: entryId, orgId },
  });

  if (!entry) {
    return { error: "Entry not found" };
  }

  const auditEntry: AuditLogEntry = {
    id: entry.id,
    orgId: entry.orgId,
    userId: entry.userId,
    action: entry.action as AuditAction,
    resource: entry.resource as AuditResource,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName || undefined,
    details: entry.details as Record<string, unknown>,
    ipAddress: entry.ipAddress || undefined,
    userAgent: entry.userAgent || undefined,
    previousHash: entry.previousHash,
    hash: entry.hash,
    timestamp: entry.timestamp,
  };

  return { proof: generateIntegrityProof(auditEntry) };
}

/**
 * Get audit statistics for an organization
 */
export async function getAuditStats(
  orgId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalEntries: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byUser: { userId: string; count: number }[];
}> {
  const where: Prisma.AuditLogWhereInput = {
    orgId,
    ...(startDate || endDate
      ? {
          timestamp: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  const [totalEntries, actionGroups, resourceGroups, userGroups] =
    await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where,
        _count: { action: true },
      }),
      prisma.auditLog.groupBy({
        by: ["resource"],
        where,
        _count: { resource: true },
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { ...where, userId: { not: null } },
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
        take: 10,
      }),
    ]);

  const byAction: Record<string, number> = {};
  for (const group of actionGroups) {
    byAction[group.action] = group._count.action;
  }

  const byResource: Record<string, number> = {};
  for (const group of resourceGroups) {
    byResource[group.resource] = group._count.resource;
  }

  const byUser = userGroups
    .filter((g) => g.userId !== null)
    .map((g) => ({
      userId: g.userId as string,
      count: g._count.userId,
    }));

  return {
    totalEntries,
    byAction,
    byResource,
    byUser,
  };
}

/**
 * Helper to log common actions
 */
export const AuditLogger = {
  async formCreated(orgId: string, userId: string, formId: string, formName: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "CREATE",
      resource: "FORM",
      resourceId: formId,
      resourceName: formName,
    });
  },

  async formUpdated(orgId: string, userId: string, formId: string, formName: string, changes: Record<string, unknown>) {
    return createAuditLog({
      orgId,
      userId,
      action: "UPDATE",
      resource: "FORM",
      resourceId: formId,
      resourceName: formName,
      details: { changes },
    });
  },

  async formPublished(orgId: string, userId: string, formId: string, formName: string, version: number) {
    return createAuditLog({
      orgId,
      userId,
      action: "PUBLISH",
      resource: "FORM",
      resourceId: formId,
      resourceName: formName,
      details: { version },
    });
  },

  async submissionCreated(orgId: string, userId: string | null, submissionId: string, formId: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "SUBMIT",
      resource: "SUBMISSION",
      resourceId: submissionId,
      details: { formId },
    });
  },

  async fileUploaded(orgId: string, userId: string, fileId: string, fileName: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "UPLOAD",
      resource: "FILE",
      resourceId: fileId,
      resourceName: fileName,
    });
  },

  async fileDownloaded(orgId: string, userId: string, fileId: string, fileName: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "DOWNLOAD",
      resource: "FILE",
      resourceId: fileId,
      resourceName: fileName,
    });
  },

  async userLogin(orgId: string, userId: string, ipAddress?: string, userAgent?: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "LOGIN",
      resource: "USER",
      resourceId: userId,
      ipAddress,
      userAgent,
    });
  },

  async dataExported(orgId: string, userId: string, resource: AuditResource, resourceId: string, format: string) {
    return createAuditLog({
      orgId,
      userId,
      action: "EXPORT",
      resource,
      resourceId,
      details: { format },
    });
  },

  // In-Person Recording Audit Methods (PX-703)
  async inPersonRecordingCreated(
    orgId: string,
    userId: string,
    recordingId: string,
    clientId: string,
    consentMethod: string
  ) {
    return createAuditLog({
      orgId,
      userId,
      action: "CREATE",
      resource: "IN_PERSON_RECORDING",
      resourceId: recordingId,
      details: { clientId, consentMethod },
    });
  },

  async inPersonRecordingAccessed(
    orgId: string,
    userId: string,
    recordingId: string,
    clientId: string
  ) {
    return createAuditLog({
      orgId,
      userId,
      action: "VIEW",
      resource: "IN_PERSON_RECORDING",
      resourceId: recordingId,
      details: { clientId },
    });
  },

  async inPersonRecordingProcessed(
    orgId: string,
    userId: string,
    recordingId: string,
    clientId: string
  ) {
    return createAuditLog({
      orgId,
      userId,
      action: "EXTRACT",
      resource: "IN_PERSON_RECORDING",
      resourceId: recordingId,
      details: { clientId },
    });
  },

  async inPersonRecordingDownloaded(
    orgId: string,
    userId: string,
    recordingId: string,
    clientId: string
  ) {
    return createAuditLog({
      orgId,
      userId,
      action: "DOWNLOAD",
      resource: "IN_PERSON_RECORDING",
      resourceId: recordingId,
      details: { clientId },
    });
  },
};
