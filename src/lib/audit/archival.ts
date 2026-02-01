/**
 * Audit Log Archival Service
 * Handles 7-year HIPAA retention and cold storage transition
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";

interface ArchivalStats {
  totalArchived: number;
  byEventType: Record<string, number>;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

interface ArchivalOptions {
  olderThanDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}

/**
 * Archive old audit logs based on retention policy
 */
export async function archiveOldLogs(
  orgId: string,
  options: ArchivalOptions = {}
): Promise<ArchivalStats> {
  const {
    olderThanDays = 365, // Default: archive logs older than 1 year
    batchSize = 1000,
    dryRun = false,
  } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const stats: ArchivalStats = {
    totalArchived: 0,
    byEventType: {},
    oldestEntry: null,
    newestEntry: null,
  };

  // Find logs eligible for archival (using details.eventType since we store it there)
  const logsToArchive = await prisma.auditLog.findMany({
    where: {
      orgId,
      timestamp: { lt: cutoffDate },
    },
    select: {
      id: true,
      timestamp: true,
      details: true,
    },
    take: batchSize,
    orderBy: { timestamp: "asc" },
  });

  if (logsToArchive.length === 0) {
    return stats;
  }

  stats.totalArchived = logsToArchive.length;
  stats.oldestEntry = logsToArchive[0].timestamp;
  stats.newestEntry = logsToArchive[logsToArchive.length - 1].timestamp;

  // Count by event type
  for (const log of logsToArchive) {
    const details = log.details as Record<string, unknown> | null;
    const eventType = (details?.eventType as string) || "UNKNOWN";
    stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
  }

  if (!dryRun) {
    const ids = logsToArchive.map((l) => l.id);
    // Mark as archived by adding to details (since we don't have archived column)
    for (const id of ids) {
      const log = await prisma.auditLog.findUnique({ where: { id } });
      if (log) {
        const existingDetails = (log.details as Record<string, unknown>) || {};
        await prisma.auditLog.update({
          where: { id },
          data: {
            details: {
              ...existingDetails,
              archived: true,
              archivedAt: new Date().toISOString(),
            },
          },
        });
      }
    }
  }

  return stats;
}

/**
 * Get archival status for an organization
 */
export async function getArchivalStatus(orgId: string): Promise<{
  totalLogs: number;
  archivedLogs: number;
  activeLogs: number;
  oldestActiveLog: Date | null;
  storageEstimateBytes: number;
}> {
  const totalLogs = await prisma.auditLog.count({ where: { orgId } });

  // Count archived logs (checking details.archived)
  const allLogs = await prisma.auditLog.findMany({
    where: { orgId },
    select: { details: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  let archivedLogs = 0;
  let oldestActiveLog: Date | null = null;

  for (const log of allLogs) {
    const details = log.details as Record<string, unknown> | null;
    if (details?.archived) {
      archivedLogs++;
    } else if (!oldestActiveLog) {
      oldestActiveLog = log.timestamp;
    }
  }

  // Rough estimate: ~500 bytes per log entry
  const storageEstimateBytes = totalLogs * 500;

  return {
    totalLogs,
    archivedLogs,
    activeLogs: totalLogs - archivedLogs,
    oldestActiveLog,
    storageEstimateBytes,
  };
}

/**
 * Check retention compliance
 */
export async function checkRetentionCompliance(orgId: string): Promise<{
  compliant: boolean;
  issues: string[];
  retentionYears: number;
  oldestLog: Date | null;
}> {
  const issues: string[] = [];
  const retentionYears = 7; // HIPAA requirement

  const oldestLog = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
  });

  // Check if any logs have been deleted prematurely
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

  const recentLogCount = await prisma.auditLog.count({
    where: {
      orgId,
      timestamp: { gte: sevenYearsAgo },
    },
  });

  if (recentLogCount === 0 && oldestLog) {
    issues.push("No logs found in the past 7 years - potential data loss");
  }

  // Check for gaps in the audit chain
  const logs = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { timestamp: "asc" },
    take: 100,
    select: { hash: true, previousHash: true },
  });

  for (let i = 1; i < logs.length; i++) {
    if (logs[i].previousHash !== logs[i - 1].hash) {
      issues.push(`Hash chain integrity issue detected at position ${i}`);
      break;
    }
  }

  return {
    compliant: issues.length === 0,
    issues,
    retentionYears,
    oldestLog: oldestLog?.timestamp || null,
  };
}

/**
 * Export logs for cold storage or compliance reporting
 */
export async function exportLogsForCompliance(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  logs: Array<{
    id: string;
    timestamp: Date;
    action: string;
    resource: string;
    resourceId: string;
    userId: string | null;
    details: unknown;
    hash: string;
    previousHash: string;
  }>;
  count: number;
  exportHash: string;
}> {
  const logs = await prisma.auditLog.findMany({
    where: {
      orgId,
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      timestamp: true,
      action: true,
      resource: true,
      resourceId: true,
      userId: true,
      details: true,
      hash: true,
      previousHash: true,
    },
  });

  // Generate export hash for integrity verification
  const exportHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(logs))
    .digest("hex");

  return {
    logs,
    count: logs.length,
    exportHash,
  };
}

/**
 * Verify hash chain integrity
 */
export async function verifyHashChain(
  orgId: string,
  options: { limit?: number; startFromId?: string } = {}
): Promise<{
  valid: boolean;
  checkedCount: number;
  firstInvalidAt?: number;
  message: string;
}> {
  const { limit = 1000, startFromId } = options;

  const whereClause: Record<string, unknown> = { orgId };
  if (startFromId) {
    const startLog = await prisma.auditLog.findUnique({
      where: { id: startFromId },
      select: { timestamp: true },
    });
    if (startLog) {
      whereClause.timestamp = { gte: startLog.timestamp };
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { timestamp: "asc" },
    take: limit,
    select: { id: true, hash: true, previousHash: true },
  });

  if (logs.length === 0) {
    return {
      valid: true,
      checkedCount: 0,
      message: "No logs to verify",
    };
  }

  for (let i = 1; i < logs.length; i++) {
    if (logs[i].previousHash !== logs[i - 1].hash) {
      return {
        valid: false,
        checkedCount: i,
        firstInvalidAt: i,
        message: `Hash chain broken at position ${i}. Expected previousHash to match hash of previous entry.`,
      };
    }
  }

  return {
    valid: true,
    checkedCount: logs.length,
    message: `Successfully verified ${logs.length} log entries`,
  };
}

/**
 * Purge logs beyond retention period (use with extreme caution)
 * This should only be called after logs have been exported and archived
 */
export async function purgeExpiredLogs(
  orgId: string,
  options: { retentionYears?: number; dryRun?: boolean; requireExportConfirmation?: string } = {}
): Promise<{
  purgedCount: number;
  oldestPurged: Date | null;
  newestPurged: Date | null;
}> {
  const { retentionYears = 7, dryRun = true, requireExportConfirmation } = options;

  // Safety check: require explicit confirmation
  if (!dryRun && requireExportConfirmation !== "CONFIRMED_EXPORTED") {
    throw new Error("Purge requires explicit confirmation that logs have been exported");
  }

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  const logsToPurge = await prisma.auditLog.findMany({
    where: {
      orgId,
      timestamp: { lt: cutoffDate },
    },
    select: {
      id: true,
      timestamp: true,
    },
    orderBy: { timestamp: "asc" },
  });

  if (logsToPurge.length === 0 || dryRun) {
    return {
      purgedCount: logsToPurge.length,
      oldestPurged: logsToPurge[0]?.timestamp || null,
      newestPurged: logsToPurge[logsToPurge.length - 1]?.timestamp || null,
    };
  }

  // Actually delete (should rarely be called)
  const ids = logsToPurge.map((l) => l.id);
  await prisma.auditLog.deleteMany({
    where: { id: { in: ids } },
  });

  return {
    purgedCount: logsToPurge.length,
    oldestPurged: logsToPurge[0].timestamp,
    newestPurged: logsToPurge[logsToPurge.length - 1].timestamp,
  };
}
