/**
 * Audit Log Archival Service
 *
 * Archives audit logs older than 90 days to S3 cold storage.
 * Implements HIPAA 7-year retention requirements with:
 * - JSONL gzip-compressed archives
 * - S3 storage pattern: audit-archives/{orgId}/{year}/{month}.jsonl.gz
 * - Hash chain integrity preservation
 * - Query support for archived logs
 *
 * @module lib/audit/archival
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import {
  S3BucketType,
  secureUpload,
  secureDownload,
  listObjects,
  isSecureS3Configured,
} from "@/lib/storage/secure-s3";
import type { AuditLogEntry, AuditAction, AuditResource } from "./types";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ============================================
// CONFIGURATION
// ============================================

/**
 * Number of days to keep logs in the primary database (hot storage)
 */
export const HOT_RETENTION_DAYS = 90;

/**
 * Archive file format version for future compatibility
 */
const ARCHIVE_FORMAT_VERSION = "1.0";

/**
 * Maximum batch size for archival operations
 */
const ARCHIVAL_BATCH_SIZE = 5000;

// ============================================
// TYPES
// ============================================

export interface ArchivalResult {
  success: boolean;
  archivedCount: number;
  deletedFromDbCount: number;
  archivesByOrg: Record<string, number>;
  errors: string[];
  skippedReason?: string;
  durationMs: number;
}

export interface ArchivedAuditLogEntry extends AuditLogEntry {
  archivedAt: Date;
  archiveVersion: string;
}

interface ArchiveMetadata {
  version: string;
  orgId: string;
  year: number;
  month: number;
  entryCount: number;
  firstEntryTimestamp: string;
  lastEntryTimestamp: string;
  exportedAt: string;
  hashChainStart: string;
  hashChainEnd: string;
  contentHash: string;
}

interface MonthlyArchiveGroup {
  orgId: string;
  year: number;
  month: number;
  entries: AuditLogEntry[];
}

// ============================================
// S3 KEY GENERATION
// ============================================

/**
 * Generate S3 key for an archive file
 * Pattern: audit-archives/{orgId}/{year}/{month}.jsonl.gz
 */
function generateArchiveKey(orgId: string, year: number, month: number): string {
  const monthStr = String(month).padStart(2, "0");
  return `audit-archives/${orgId}/${year}/${monthStr}.jsonl.gz`;
}

/**
 * Parse S3 key to extract archive metadata
 */
function parseArchiveKey(key: string): { orgId: string; year: number; month: number } | null {
  const match = key.match(/^audit-archives\/([^/]+)\/(\d{4})\/(\d{2})\.jsonl\.gz$/);
  if (!match) return null;

  return {
    orgId: match[1],
    year: parseInt(match[2], 10),
    month: parseInt(match[3], 10),
  };
}

// ============================================
// ARCHIVE CREATION
// ============================================

/**
 * Convert database audit log entries to the archive format
 */
function convertToArchiveEntry(
  dbEntry: {
    id: string;
    orgId: string;
    userId: string | null;
    action: string;
    resource: string;
    resourceId: string;
    resourceName: string | null;
    details: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    previousHash: string;
    hash: string;
    timestamp: Date;
  }
): AuditLogEntry {
  return {
    id: dbEntry.id,
    orgId: dbEntry.orgId,
    userId: dbEntry.userId,
    action: dbEntry.action as AuditAction,
    resource: dbEntry.resource as AuditResource,
    resourceId: dbEntry.resourceId,
    resourceName: dbEntry.resourceName ?? undefined,
    details: (dbEntry.details as Record<string, unknown>) ?? {},
    ipAddress: dbEntry.ipAddress ?? undefined,
    userAgent: dbEntry.userAgent ?? undefined,
    previousHash: dbEntry.previousHash,
    hash: dbEntry.hash,
    timestamp: dbEntry.timestamp,
  };
}

/**
 * Create JSONL content from entries with metadata header
 */
function createJSONLContent(entries: AuditLogEntry[], metadata: ArchiveMetadata): string {
  const lines: string[] = [];

  // First line is always metadata
  lines.push(JSON.stringify({ __metadata: metadata }));

  // Subsequent lines are individual entries
  for (const entry of entries) {
    lines.push(JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }));
  }

  return lines.join("\n");
}

/**
 * Parse JSONL content back to entries
 */
function parseJSONLContent(content: string): {
  metadata: ArchiveMetadata;
  entries: AuditLogEntry[];
} {
  const lines = content.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("Empty archive file");
  }

  // First line is metadata
  const firstLine = JSON.parse(lines[0]);
  if (!firstLine.__metadata) {
    throw new Error("Invalid archive format: missing metadata");
  }

  const metadata = firstLine.__metadata as ArchiveMetadata;
  const entries: AuditLogEntry[] = [];

  // Parse remaining lines as entries
  for (let i = 1; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]);
    entries.push({
      ...parsed,
      timestamp: new Date(parsed.timestamp),
    });
  }

  return { metadata, entries };
}

/**
 * Group entries by organization and month
 */
function groupEntriesByOrgAndMonth(entries: AuditLogEntry[]): MonthlyArchiveGroup[] {
  const groups = new Map<string, MonthlyArchiveGroup>();

  for (const entry of entries) {
    const year = entry.timestamp.getFullYear();
    const month = entry.timestamp.getMonth() + 1;
    const key = `${entry.orgId}:${year}:${month}`;

    if (!groups.has(key)) {
      groups.set(key, {
        orgId: entry.orgId,
        year,
        month,
        entries: [],
      });
    }

    groups.get(key)!.entries.push(entry);
  }

  // Sort entries within each group by timestamp
  for (const group of groups.values()) {
    group.entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  return Array.from(groups.values());
}

/**
 * Create archive metadata from entries
 */
function createArchiveMetadata(
  orgId: string,
  year: number,
  month: number,
  entries: AuditLogEntry[],
  contentHash: string
): ArchiveMetadata {
  return {
    version: ARCHIVE_FORMAT_VERSION,
    orgId,
    year,
    month,
    entryCount: entries.length,
    firstEntryTimestamp: entries[0].timestamp.toISOString(),
    lastEntryTimestamp: entries[entries.length - 1].timestamp.toISOString(),
    exportedAt: new Date().toISOString(),
    hashChainStart: entries[0].previousHash,
    hashChainEnd: entries[entries.length - 1].hash,
    contentHash,
  };
}

// ============================================
// MAIN ARCHIVAL FUNCTION
// ============================================

/**
 * Archive old audit logs to S3 and remove from primary database
 *
 * This function:
 * 1. Finds logs older than HOT_RETENTION_DAYS
 * 2. Groups them by organization and month
 * 3. Compresses and uploads to S3 as JSONL.gz
 * 4. Deletes archived logs from the primary database
 *
 * @returns ArchivalResult with counts and any errors
 */
export async function archiveOldAuditLogs(): Promise<ArchivalResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const archivesByOrg: Record<string, number> = {};
  let archivedCount = 0;
  let deletedFromDbCount = 0;

  // Check if S3 is configured
  if (!isSecureS3Configured()) {
    console.log("[AuditArchival] S3 not configured, skipping archival");
    return {
      success: true,
      archivedCount: 0,
      deletedFromDbCount: 0,
      archivesByOrg: {},
      errors: [],
      skippedReason: "S3 not configured",
      durationMs: Date.now() - startTime,
    };
  }

  // Check if AUDIT_LOGS bucket is configured
  const auditBucket = process.env.AWS_S3_BUCKET_AUDIT_LOGS;
  if (!auditBucket) {
    console.log("[AuditArchival] AWS_S3_BUCKET_AUDIT_LOGS not configured, skipping archival");
    return {
      success: true,
      archivedCount: 0,
      deletedFromDbCount: 0,
      archivesByOrg: {},
      errors: [],
      skippedReason: "AWS_S3_BUCKET_AUDIT_LOGS not configured",
      durationMs: Date.now() - startTime,
    };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HOT_RETENTION_DAYS);

  console.log(`[AuditArchival] Archiving logs older than ${cutoffDate.toISOString()}`);

  try {
    // Fetch logs eligible for archival
    const logsToArchive = await prisma.auditLog.findMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
      orderBy: { timestamp: "asc" },
      take: ARCHIVAL_BATCH_SIZE,
    });

    if (logsToArchive.length === 0) {
      console.log("[AuditArchival] No logs to archive");
      return {
        success: true,
        archivedCount: 0,
        deletedFromDbCount: 0,
        archivesByOrg: {},
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    console.log(`[AuditArchival] Found ${logsToArchive.length} logs to archive`);

    // Convert to archive format
    const entries = logsToArchive.map(convertToArchiveEntry);

    // Group by org and month
    const groups = groupEntriesByOrgAndMonth(entries);

    console.log(`[AuditArchival] Grouped into ${groups.length} monthly archives`);

    const archivedLogIds: string[] = [];

    // Process each group
    for (const group of groups) {
      try {
        // Create JSONL content
        const contentForHash = group.entries
          .map((e) => JSON.stringify({ ...e, timestamp: e.timestamp.toISOString() }))
          .join("\n");
        const contentHash = crypto
          .createHash("sha256")
          .update(contentForHash)
          .digest("hex");

        const metadata = createArchiveMetadata(
          group.orgId,
          group.year,
          group.month,
          group.entries,
          contentHash
        );

        const jsonlContent = createJSONLContent(group.entries, metadata);

        // Compress with gzip
        const compressedContent = await gzipAsync(Buffer.from(jsonlContent, "utf-8"));

        // Generate S3 key
        const s3Key = generateArchiveKey(group.orgId, group.year, group.month);

        // Check if archive already exists (append scenario)
        let existingEntries: AuditLogEntry[] = [];
        try {
          const existingArchive = await loadArchiveFromS3(group.orgId, group.year, group.month);
          if (existingArchive) {
            existingEntries = existingArchive.entries;
            console.log(
              `[AuditArchival] Found existing archive for ${group.orgId}/${group.year}/${group.month} with ${existingEntries.length} entries`
            );
          }
        } catch {
          // Archive doesn't exist, that's fine
        }

        // Merge entries if archive exists
        let finalEntries = group.entries;
        if (existingEntries.length > 0) {
          // Deduplicate by ID and sort
          const allEntries = [...existingEntries, ...group.entries];
          const seenIds = new Set<string>();
          finalEntries = [];
          for (const entry of allEntries) {
            if (!seenIds.has(entry.id)) {
              seenIds.add(entry.id);
              finalEntries.push(entry);
            }
          }
          finalEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          // Recreate content with merged entries
          const mergedContentForHash = finalEntries
            .map((e) => JSON.stringify({ ...e, timestamp: e.timestamp.toISOString() }))
            .join("\n");
          const mergedContentHash = crypto
            .createHash("sha256")
            .update(mergedContentForHash)
            .digest("hex");

          const mergedMetadata = createArchiveMetadata(
            group.orgId,
            group.year,
            group.month,
            finalEntries,
            mergedContentHash
          );

          const mergedJsonlContent = createJSONLContent(finalEntries, mergedMetadata);
          const mergedCompressed = await gzipAsync(Buffer.from(mergedJsonlContent, "utf-8"));

          // Upload merged archive
          const uploadResult = await secureUpload(
            S3BucketType.AUDIT_LOGS,
            s3Key,
            mergedCompressed,
            {
              contentType: "application/gzip",
              metadata: {
                "archive-version": ARCHIVE_FORMAT_VERSION,
                "org-id": group.orgId,
                "year": String(group.year),
                "month": String(group.month),
                "entry-count": String(finalEntries.length),
                "content-hash": mergedContentHash,
              },
            }
          );

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || "Upload failed");
          }
        } else {
          // Upload new archive
          const uploadResult = await secureUpload(
            S3BucketType.AUDIT_LOGS,
            s3Key,
            compressedContent,
            {
              contentType: "application/gzip",
              metadata: {
                "archive-version": ARCHIVE_FORMAT_VERSION,
                "org-id": group.orgId,
                "year": String(group.year),
                "month": String(group.month),
                "entry-count": String(group.entries.length),
                "content-hash": contentHash,
              },
            }
          );

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || "Upload failed");
          }
        }

        // Track successful archival
        archivedCount += group.entries.length;
        archivesByOrg[group.orgId] = (archivesByOrg[group.orgId] || 0) + group.entries.length;
        archivedLogIds.push(...group.entries.map((e) => e.id));

        console.log(
          `[AuditArchival] Archived ${group.entries.length} entries for ${group.orgId}/${group.year}/${group.month}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to archive ${group.orgId}/${group.year}/${group.month}: ${errorMessage}`);
        console.error(`[AuditArchival] Error archiving group:`, error);
      }
    }

    // Delete archived logs from database
    if (archivedLogIds.length > 0) {
      const deleteResult = await prisma.auditLog.deleteMany({
        where: {
          id: { in: archivedLogIds },
        },
      });
      deletedFromDbCount = deleteResult.count;
      console.log(`[AuditArchival] Deleted ${deletedFromDbCount} archived logs from database`);
    }

    return {
      success: errors.length === 0,
      archivedCount,
      deletedFromDbCount,
      archivesByOrg,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[AuditArchival] Fatal error during archival:", error);
    return {
      success: false,
      archivedCount,
      deletedFromDbCount,
      archivesByOrg,
      errors: [...errors, `Fatal error: ${errorMessage}`],
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================
// ARCHIVE QUERY FUNCTIONS
// ============================================

/**
 * Load an archive from S3
 */
async function loadArchiveFromS3(
  orgId: string,
  year: number,
  month: number
): Promise<{ metadata: ArchiveMetadata; entries: AuditLogEntry[] } | null> {
  const s3Key = generateArchiveKey(orgId, year, month);

  const downloadResult = await secureDownload(S3BucketType.AUDIT_LOGS, s3Key);

  if (!downloadResult.success || !downloadResult.data) {
    return null;
  }

  // Decompress
  const decompressed = await gunzipAsync(downloadResult.data);
  const content = decompressed.toString("utf-8");

  // Parse JSONL
  return parseJSONLContent(content);
}

/**
 * Query archived logs for a specific organization within a date range
 *
 * @param orgId - Organization ID
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of audit log entries from archives
 */
export async function queryArchivedLogs(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<AuditLogEntry[]> {
  // Check if S3 is configured
  if (!isSecureS3Configured() || !process.env.AWS_S3_BUCKET_AUDIT_LOGS) {
    console.log("[AuditArchival] S3 not configured, cannot query archived logs");
    return [];
  }

  const results: AuditLogEntry[] = [];

  // Determine which months to query
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;

  const monthsToQuery: { year: number; month: number }[] = [];

  let currentYear = startYear;
  let currentMonth = startMonth;

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    monthsToQuery.push({ year: currentYear, month: currentMonth });

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  console.log(
    `[AuditArchival] Querying ${monthsToQuery.length} monthly archives for ${orgId}`
  );

  // Query each monthly archive
  for (const { year, month } of monthsToQuery) {
    try {
      const archive = await loadArchiveFromS3(orgId, year, month);
      if (archive) {
        // Filter entries within the date range
        const filtered = archive.entries.filter(
          (entry) =>
            entry.timestamp >= startDate && entry.timestamp <= endDate
        );
        results.push(...filtered);
      }
    } catch (error) {
      console.warn(
        `[AuditArchival] Could not load archive for ${orgId}/${year}/${month}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Sort results by timestamp
  results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  console.log(
    `[AuditArchival] Found ${results.length} entries in archives for date range`
  );

  return results;
}

/**
 * List all archived months for an organization
 */
export async function listArchivedMonths(
  orgId: string
): Promise<{ year: number; month: number; entryCount?: number }[]> {
  if (!isSecureS3Configured() || !process.env.AWS_S3_BUCKET_AUDIT_LOGS) {
    return [];
  }

  const prefix = `audit-archives/${orgId}/`;
  const results: { year: number; month: number; entryCount?: number }[] = [];

  try {
    const listResult = await listObjects(S3BucketType.AUDIT_LOGS, prefix);

    for (const key of listResult.keys) {
      const parsed = parseArchiveKey(key);
      if (parsed && parsed.orgId === orgId) {
        results.push({ year: parsed.year, month: parsed.month });
      }
    }

    // Sort by date
    results.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  } catch (error) {
    console.error("[AuditArchival] Error listing archived months:", error);
  }

  return results;
}

// ============================================
// LEGACY FUNCTIONS (kept for backward compatibility)
// ============================================

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
 * Archive old audit logs based on retention policy (legacy function)
 * @deprecated Use archiveOldAuditLogs() instead
 */
export async function archiveOldLogs(
  orgId: string,
  options: ArchivalOptions = {}
): Promise<ArchivalStats> {
  const {
    olderThanDays = HOT_RETENTION_DAYS,
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

  const logsToArchive = await prisma.auditLog.findMany({
    where: {
      orgId,
      timestamp: { lt: cutoffDate },
    },
    select: {
      id: true,
      timestamp: true,
      details: true,
      action: true,
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

  for (const log of logsToArchive) {
    const eventType = log.action || "UNKNOWN";
    stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
  }

  if (!dryRun) {
    // Trigger the new S3 archival
    await archiveOldAuditLogs();
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
  archivedMonths: { year: number; month: number }[];
}> {
  const totalLogs = await prisma.auditLog.count({ where: { orgId } });

  const oldestLog = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
  });

  // Get archived months from S3
  const archivedMonths = await listArchivedMonths(orgId);

  // Rough estimate: ~500 bytes per log entry
  const storageEstimateBytes = totalLogs * 500;

  return {
    totalLogs,
    archivedLogs: 0, // Would need to sum from S3 archives
    activeLogs: totalLogs,
    oldestActiveLog: oldestLog?.timestamp || null,
    storageEstimateBytes,
    archivedMonths,
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
  oldestArchivedLog: Date | null;
}> {
  const issues: string[] = [];
  const retentionYears = 7; // HIPAA requirement

  const oldestLog = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
  });

  // Check archived logs
  const archivedMonths = await listArchivedMonths(orgId);
  let oldestArchivedLog: Date | null = null;

  if (archivedMonths.length > 0) {
    const oldest = archivedMonths[0];
    oldestArchivedLog = new Date(oldest.year, oldest.month - 1, 1);
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
    oldestArchivedLog,
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
  archivedLogs: AuditLogEntry[];
  count: number;
  exportHash: string;
}> {
  // Get active logs from database
  const dbLogs = await prisma.auditLog.findMany({
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

  // Get archived logs
  const archivedLogs = await queryArchivedLogs(orgId, startDate, endDate);

  // Combine for hash calculation
  const allLogs = [...archivedLogs, ...dbLogs];
  const exportHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(allLogs))
    .digest("hex");

  return {
    logs: dbLogs,
    archivedLogs,
    count: dbLogs.length + archivedLogs.length,
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
