/**
 * File Upload Virus Scanning with Async Quarantine
 *
 * HIPAA/SOC2 compliant file upload pipeline with:
 * - Quarantine storage for untrusted files
 * - Async virus scanning with ClamAV or external API
 * - Automatic promotion/deletion based on scan results
 * - Security alerting for infected files
 * - Graceful degradation when scanner unavailable
 *
 * @module lib/files/virus-scan
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { AuditLogger } from "@/lib/audit/service";
import {
  secureUpload,
  secureDownload,
  secureDelete,
  copyObject,
  objectExists,
  S3BucketType,
} from "@/lib/storage/secure-s3";
import {
  scanFile as performScan,
  isClamAVConfigured,
  isExternalScannerConfigured,
  verifyFileSignature,
  calculateFileHash,
} from "./scanner";
import type { ScanResult, ScanStatus } from "./types";

// ============================================
// TYPES
// ============================================

/**
 * Quarantine status for uploaded files
 */
export enum QuarantineStatus {
  /** File is being scanned */
  SCANNING = "SCANNING",
  /** File passed all security checks */
  CLEAN = "CLEAN",
  /** File was identified as malicious */
  INFECTED = "INFECTED",
  /** An error occurred during scanning */
  ERROR = "ERROR",
}

/**
 * Metadata required for file uploads
 */
export interface FileMetadata {
  orgId: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Result of quarantine upload operation
 */
export interface QuarantinedFile {
  id: string;
  status: QuarantineStatus;
  estimatedTime: number; // Estimated scan time in seconds
  quarantineKey: string;
  uploadedAt: Date;
}

/**
 * Result of virus scan operation
 */
export interface VirusScanResult {
  clean: boolean;
  threat?: string;
  threats?: string[];
  scannedAt: Date;
  scannerType: "clamav" | "external-api" | "pattern" | "bypass";
  error?: string;
}

/**
 * Quarantine file record for tracking
 */
export interface QuarantineRecord {
  id: string;
  orgId: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  quarantineKey: string;
  productionKey?: string;
  status: QuarantineStatus;
  scanResult?: VirusScanResult;
  fileHash: string;
  createdAt: Date;
  scannedAt?: Date;
  processedAt?: Date;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Feature flag for virus scanning
 * When disabled, files pass through without scanning (logged as warning)
 */
export function isVirusScanEnabled(): boolean {
  return process.env.VIRUS_SCAN_ENABLED !== "false";
}

/**
 * Check if any virus scanner is available
 */
export function isScannerAvailable(): boolean {
  return (
    isClamAVConfigured() ||
    isExternalScannerConfigured() ||
    !!process.env.VIRUS_SCAN_API_URL
  );
}

/**
 * Configuration for virus scanning
 */
export const VIRUS_SCAN_CONFIG = {
  // Quarantine storage prefix
  quarantinePrefix: "quarantine/",
  // Production storage prefix
  productionPrefix: "files/",
  // Maximum time to wait for scan (ms)
  scanTimeoutMs: 120000, // 2 minutes
  // Estimated scan time per MB (seconds)
  estimatedScanTimePerMb: 0.5,
  // Minimum estimated scan time (seconds)
  minEstimatedScanTime: 5,
  // Maximum estimated scan time (seconds)
  maxEstimatedScanTime: 120,
  // Whether to alert security team on infection
  alertOnInfection: true,
  // Whether to bypass scanning if no scanner available (dangerous in production)
  allowScanBypass: process.env.NODE_ENV !== "production",
};

// ============================================
// QUARANTINE KEY GENERATION
// ============================================

/**
 * Generate a unique quarantine key for a file
 */
function generateQuarantineKey(
  orgId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(16).toString("hex");
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 100);

  return `${VIRUS_SCAN_CONFIG.quarantinePrefix}${orgId}/${timestamp}/${randomId}/${sanitizedFilename}`;
}

/**
 * Generate production storage key from quarantine key
 */
function generateProductionKey(quarantineKey: string): string {
  // Replace quarantine prefix with production prefix, keeping the rest of the path
  return quarantineKey.replace(
    VIRUS_SCAN_CONFIG.quarantinePrefix,
    VIRUS_SCAN_CONFIG.productionPrefix
  );
}

/**
 * Estimate scan time based on file size
 */
function estimateScanTime(sizeBytes: number): number {
  const sizeMb = sizeBytes / (1024 * 1024);
  const estimatedSeconds =
    sizeMb * VIRUS_SCAN_CONFIG.estimatedScanTimePerMb;

  return Math.min(
    VIRUS_SCAN_CONFIG.maxEstimatedScanTime,
    Math.max(VIRUS_SCAN_CONFIG.minEstimatedScanTime, estimatedSeconds)
  );
}

// ============================================
// MAIN UPLOAD FUNCTION
// ============================================

/**
 * Upload a file to quarantine storage and queue for scanning
 *
 * This is the main entry point for secure file uploads.
 * Files are stored in a quarantine location and scanned asynchronously.
 *
 * @param file - File content as Buffer
 * @param metadata - File metadata (org, user, filename, etc.)
 * @returns Quarantined file info with scan status
 *
 * @example
 * ```ts
 * const result = await uploadWithQuarantine(fileBuffer, {
 *   orgId: "org_123",
 *   userId: "user_456",
 *   filename: "document.pdf",
 *   contentType: "application/pdf",
 *   size: fileBuffer.length,
 * });
 *
 * // Poll for status
 * const status = await getQuarantineStatus(result.id);
 * ```
 */
export async function uploadWithQuarantine(
  file: Buffer,
  metadata: FileMetadata
): Promise<QuarantinedFile> {
  const { orgId, userId, filename, contentType, size } = metadata;

  // Generate unique file ID and quarantine key
  const fileId = crypto.randomUUID();
  const quarantineKey = generateQuarantineKey(orgId, filename);
  const fileHash = calculateFileHash(file, "sha256");

  // Quick signature verification before upload
  const signatureCheck = verifyFileSignature(file, contentType);
  if (!signatureCheck.valid) {
    console.warn(
      `[VirusScan] File signature mismatch for ${filename}: ${signatureCheck.error}`
    );
    // Continue with upload but mark for careful scanning
  }

  // Upload to quarantine storage
  const uploadResult = await secureUpload(
    S3BucketType.UPLOADS,
    quarantineKey,
    file,
    {
      contentType,
      metadata: {
        "x-quarantine-id": fileId,
        "x-org-id": orgId,
        "x-user-id": userId,
        "x-original-filename": filename,
        "x-file-hash": fileHash,
        "x-quarantine-status": QuarantineStatus.SCANNING,
      },
    }
  );

  if (!uploadResult.success) {
    throw new Error(`Failed to upload file to quarantine: ${uploadResult.error}`);
  }

  // Create database record
  const quarantineRecord = await prisma.fileUpload.create({
    data: {
      id: fileId,
      orgId,
      originalName: filename,
      storagePath: quarantineKey,
      mimeType: contentType,
      sizeBytes: size,
      scanStatus: "SCANNING",
      uploadedById: userId,
      scanResult: {
        quarantineKey,
        fileHash,
        signatureValid: signatureCheck.valid,
        detectedType: signatureCheck.detectedType,
      },
    },
  });

  // Log the upload
  await AuditLogger.fileUploaded(orgId, userId, fileId, filename);

  console.log(
    `[VirusScan] File ${fileId} uploaded to quarantine: ${quarantineKey}`
  );

  // Queue scan job (non-blocking)
  queueScanJob(fileId, quarantineKey, file).catch((err) => {
    console.error(`[VirusScan] Failed to queue scan job for ${fileId}:`, err);
  });

  return {
    id: fileId,
    status: QuarantineStatus.SCANNING,
    estimatedTime: estimateScanTime(size),
    quarantineKey,
    uploadedAt: quarantineRecord.uploadedAt,
  };
}

// ============================================
// SCAN OPERATIONS
// ============================================

/**
 * Queue a file for virus scanning
 */
async function queueScanJob(
  fileId: string,
  quarantineKey: string,
  content: Buffer
): Promise<void> {
  // Perform scan immediately (could be moved to job queue for higher scale)
  try {
    const result = await scanFile(quarantineKey, content);
    await processQuarantinedFile(fileId, result);
  } catch (error) {
    console.error(`[VirusScan] Scan failed for ${fileId}:`, error);
    await updateScanStatus(fileId, QuarantineStatus.ERROR, {
      clean: false,
      scannedAt: new Date(),
      scannerType: "pattern",
      error: error instanceof Error ? error.message : "Scan failed",
    });
  }
}

/**
 * Scan a file for viruses
 *
 * Supports multiple scanning backends with fallback:
 * 1. ClamAV (if CLAMAV_HOST is configured)
 * 2. External API (if VIRUS_SCAN_API_URL is configured)
 * 3. Pattern-based scanning (fallback)
 * 4. Bypass mode (only in non-production, when no scanner available)
 *
 * @param quarantineKey - S3 key of the quarantined file
 * @param content - Optional file content (if not provided, will be downloaded)
 * @returns Scan result
 */
export async function scanFile(
  quarantineKey: string,
  content?: Buffer
): Promise<VirusScanResult> {
  // Check if scanning is enabled
  if (!isVirusScanEnabled()) {
    console.warn(
      `[VirusScan] Virus scanning disabled by VIRUS_SCAN_ENABLED=false`
    );
    return {
      clean: true,
      scannedAt: new Date(),
      scannerType: "bypass",
      error: "Virus scanning disabled",
    };
  }

  // Get file content if not provided
  let fileContent = content;
  if (!fileContent) {
    const downloadResult = await secureDownload(
      S3BucketType.UPLOADS,
      quarantineKey
    );
    if (!downloadResult.success || !downloadResult.data) {
      throw new Error(
        `Failed to download quarantined file: ${downloadResult.error}`
      );
    }
    fileContent = downloadResult.data;
  }

  // Check if any scanner is available
  if (!isScannerAvailable()) {
    if (VIRUS_SCAN_CONFIG.allowScanBypass) {
      console.warn(
        `[VirusScan] No virus scanner configured, bypassing scan (non-production mode)`
      );
      return {
        clean: true,
        scannedAt: new Date(),
        scannerType: "bypass",
        error: "No virus scanner configured",
      };
    }
    throw new Error(
      "No virus scanner configured and bypass not allowed in production"
    );
  }

  // Try external API first (if configured via VIRUS_SCAN_API_URL)
  if (process.env.VIRUS_SCAN_API_URL) {
    try {
      const result = await scanWithExternalVirusAPI(fileContent);
      if (!result.error) {
        return result;
      }
      console.warn(`[VirusScan] External API scan failed: ${result.error}`);
    } catch (error) {
      console.warn(`[VirusScan] External API scan error:`, error);
    }
  }

  // Fall back to built-in scanning (ClamAV or pattern)
  const scanResult = await performScan(fileContent);

  return {
    clean: scanResult.status === "CLEAN",
    threat: scanResult.threats?.[0],
    threats: scanResult.threats,
    scannedAt: scanResult.scannedAt,
    scannerType: scanResult.scannerVersion?.includes("clamav")
      ? "clamav"
      : scanResult.scannerVersion?.includes("external")
      ? "external-api"
      : "pattern",
    error: scanResult.error,
  };
}

/**
 * Scan file using external virus scanning API
 *
 * Supports APIs like VirusTotal, Metadefender, or custom scanning services.
 * Configure via VIRUS_SCAN_API_URL and VIRUS_SCAN_API_KEY.
 */
async function scanWithExternalVirusAPI(content: Buffer): Promise<VirusScanResult> {
  const apiUrl = process.env.VIRUS_SCAN_API_URL;
  const apiKey = process.env.VIRUS_SCAN_API_KEY;

  if (!apiUrl) {
    return {
      clean: false,
      scannedAt: new Date(),
      scannerType: "external-api",
      error: "VIRUS_SCAN_API_URL not configured",
    };
  }

  try {
    // Calculate hash for deduplication
    const fileHash = calculateFileHash(content, "sha256");

    // First, check if hash is already known
    const hashCheckResponse = await fetch(`${apiUrl}/hash/${fileHash}`, {
      method: "GET",
      headers: {
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        Accept: "application/json",
      },
    });

    if (hashCheckResponse.ok) {
      const hashResult = await hashCheckResponse.json();
      if (hashResult.known) {
        return {
          clean: !hashResult.malicious,
          threat: hashResult.threatName,
          threats: hashResult.threats,
          scannedAt: new Date(),
          scannerType: "external-api",
        };
      }
    }

    // If hash not known, submit file for scanning
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(content)], { type: "application/octet-stream" });
    formData.append("file", blob, "upload");

    const scanResponse = await fetch(`${apiUrl}/scan`, {
      method: "POST",
      headers: {
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: formData,
      signal: AbortSignal.timeout(VIRUS_SCAN_CONFIG.scanTimeoutMs),
    });

    if (!scanResponse.ok) {
      throw new Error(`Scan API returned ${scanResponse.status}`);
    }

    const scanResult = await scanResponse.json();

    return {
      clean: !scanResult.malicious,
      threat: scanResult.threatName,
      threats: scanResult.threats,
      scannedAt: new Date(),
      scannerType: "external-api",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "API scan failed";
    return {
      clean: false,
      scannedAt: new Date(),
      scannerType: "external-api",
      error: errorMessage,
    };
  }
}

// ============================================
// QUARANTINE PROCESSING
// ============================================

/**
 * Process a quarantined file after scanning
 *
 * Based on scan result:
 * - Clean: Move to production storage, update status
 * - Infected: Delete file, notify user, alert security team
 * - Error: Keep in quarantine, may retry later
 *
 * @param fileId - Database ID of the quarantined file
 * @param scanResult - Result from virus scan (optional, will scan if not provided)
 */
export async function processQuarantinedFile(
  fileId: string,
  scanResult?: VirusScanResult
): Promise<void> {
  // Get file record
  const fileRecord = await prisma.fileUpload.findUnique({
    where: { id: fileId },
  });

  if (!fileRecord) {
    throw new Error(`File not found: ${fileId}`);
  }

  const quarantineKey = fileRecord.storagePath;
  const scanResultData =
    (fileRecord.scanResult as Record<string, unknown>) || {};

  // Scan if result not provided
  let result = scanResult;
  if (!result) {
    result = await scanFile(quarantineKey);
  }

  // Process based on scan result
  if (result.clean) {
    await handleCleanFile(fileRecord, result);
  } else if (result.error && !result.threat) {
    await handleScanError(fileRecord, result);
  } else {
    await handleInfectedFile(fileRecord, result);
  }
}

/**
 * Handle a clean file - move to production storage
 */
async function handleCleanFile(
  fileRecord: { id: string; orgId: string; storagePath: string; originalName: string },
  scanResult: VirusScanResult
): Promise<void> {
  const { id, orgId, storagePath: quarantineKey, originalName } = fileRecord;
  const productionKey = generateProductionKey(quarantineKey);

  // Copy to production storage
  const copyResult = await copyObject(
    S3BucketType.UPLOADS,
    quarantineKey,
    productionKey
  );

  if (!copyResult.success) {
    throw new Error(`Failed to copy file to production: ${copyResult.error}`);
  }

  // Delete from quarantine
  await secureDelete(S3BucketType.UPLOADS, quarantineKey);

  // Update database record
  await prisma.fileUpload.update({
    where: { id },
    data: {
      storagePath: productionKey,
      scanStatus: "CLEAN",
      scanResult: {
        ...((await prisma.fileUpload.findUnique({
          where: { id },
          select: { scanResult: true },
        }))?.scanResult as object || {}),
        scanResult: {
          clean: true,
          scannerType: scanResult.scannerType,
          scannedAt: scanResult.scannedAt.toISOString(),
        },
      },
      scannedAt: scanResult.scannedAt,
    },
  });

  console.log(
    `[VirusScan] File ${id} passed scan, moved to production: ${productionKey}`
  );
}

/**
 * Handle an infected file - delete and alert
 */
async function handleInfectedFile(
  fileRecord: { id: string; orgId: string; storagePath: string; originalName: string; uploadedById: string },
  scanResult: VirusScanResult
): Promise<void> {
  const { id, orgId, storagePath: quarantineKey, originalName, uploadedById } = fileRecord;

  // Delete infected file immediately
  await secureDelete(S3BucketType.UPLOADS, quarantineKey);

  // Update database record (keep record for audit trail)
  await prisma.fileUpload.update({
    where: { id },
    data: {
      scanStatus: "INFECTED",
      scanResult: {
        ...((await prisma.fileUpload.findUnique({
          where: { id },
          select: { scanResult: true },
        }))?.scanResult as object || {}),
        scanResult: {
          clean: false,
          threat: scanResult.threat,
          threats: scanResult.threats,
          scannerType: scanResult.scannerType,
          scannedAt: scanResult.scannedAt.toISOString(),
        },
        deleted: true,
        deletedAt: new Date().toISOString(),
      },
      scannedAt: scanResult.scannedAt,
    },
  });

  console.error(
    `[VirusScan] SECURITY ALERT: Infected file detected and deleted - ` +
      `fileId=${id}, threat=${scanResult.threat}, filename=${originalName}`
  );

  // Alert security team if configured
  if (VIRUS_SCAN_CONFIG.alertOnInfection) {
    await alertSecurityTeam({
      fileId: id,
      orgId,
      userId: uploadedById,
      filename: originalName,
      threat: scanResult.threat,
      threats: scanResult.threats,
      scannerType: scanResult.scannerType,
      detectedAt: scanResult.scannedAt,
    });
  }

  // Notify the user who uploaded the file
  await notifyUserOfInfectedFile(uploadedById, originalName, scanResult.threat);
}

/**
 * Handle scan error - keep in quarantine for retry
 */
async function handleScanError(
  fileRecord: { id: string; orgId: string; storagePath: string; originalName: string },
  scanResult: VirusScanResult
): Promise<void> {
  const { id, orgId, storagePath, originalName } = fileRecord;

  // Update status to error but keep file in quarantine
  await prisma.fileUpload.update({
    where: { id },
    data: {
      scanStatus: "ERROR",
      scanResult: {
        ...((await prisma.fileUpload.findUnique({
          where: { id },
          select: { scanResult: true },
        }))?.scanResult as object || {}),
        scanResult: {
          clean: false,
          error: scanResult.error,
          scannerType: scanResult.scannerType,
          scannedAt: scanResult.scannedAt.toISOString(),
        },
      },
      scannedAt: scanResult.scannedAt,
    },
  });

  console.warn(
    `[VirusScan] Scan error for file ${id}: ${scanResult.error}. File kept in quarantine.`
  );
}

// ============================================
// STATUS QUERIES
// ============================================

/**
 * Get the current quarantine status of a file
 *
 * @param fileId - Database ID of the file
 * @returns Current quarantine status and scan result
 */
export async function getQuarantineStatus(
  fileId: string
): Promise<{
  id: string;
  status: QuarantineStatus;
  scanResult?: VirusScanResult;
  filename: string;
  uploadedAt: Date;
  scannedAt?: Date;
  storagePath?: string;
} | null> {
  const record = await prisma.fileUpload.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      scanStatus: true,
      scanResult: true,
      originalName: true,
      uploadedAt: true,
      scannedAt: true,
      storagePath: true,
    },
  });

  if (!record) {
    return null;
  }

  const scanResultData = record.scanResult as Record<string, unknown> | null;

  return {
    id: record.id,
    status: mapScanStatusToQuarantineStatus(record.scanStatus as ScanStatus),
    scanResult: scanResultData?.scanResult as VirusScanResult | undefined,
    filename: record.originalName,
    uploadedAt: record.uploadedAt,
    scannedAt: record.scannedAt || undefined,
    storagePath:
      record.scanStatus === "CLEAN" ? record.storagePath : undefined,
  };
}

/**
 * List quarantined files for an organization
 */
export async function listQuarantinedFiles(
  orgId: string,
  options: {
    status?: QuarantineStatus;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  files: Array<{
    id: string;
    filename: string;
    status: QuarantineStatus;
    uploadedAt: Date;
    scannedAt?: Date;
  }>;
  total: number;
}> {
  const { status, limit = 50, offset = 0 } = options;

  const where = {
    orgId,
    ...(status && { scanStatus: mapQuarantineStatusToScanStatus(status) }),
  };

  const [files, total] = await Promise.all([
    prisma.fileUpload.findMany({
      where,
      select: {
        id: true,
        originalName: true,
        scanStatus: true,
        uploadedAt: true,
        scannedAt: true,
      },
      orderBy: { uploadedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.fileUpload.count({ where }),
  ]);

  return {
    files: files.map((f) => ({
      id: f.id,
      filename: f.originalName,
      status: mapScanStatusToQuarantineStatus(f.scanStatus as ScanStatus),
      uploadedAt: f.uploadedAt,
      scannedAt: f.scannedAt || undefined,
    })),
    total,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map internal ScanStatus to QuarantineStatus
 */
function mapScanStatusToQuarantineStatus(
  scanStatus: ScanStatus
): QuarantineStatus {
  switch (scanStatus) {
    case "PENDING":
    case "SCANNING":
      return QuarantineStatus.SCANNING;
    case "CLEAN":
      return QuarantineStatus.CLEAN;
    case "INFECTED":
      return QuarantineStatus.INFECTED;
    case "ERROR":
    default:
      return QuarantineStatus.ERROR;
  }
}

/**
 * Map QuarantineStatus to internal ScanStatus
 */
function mapQuarantineStatusToScanStatus(
  status: QuarantineStatus
): ScanStatus {
  switch (status) {
    case QuarantineStatus.SCANNING:
      return "SCANNING";
    case QuarantineStatus.CLEAN:
      return "CLEAN";
    case QuarantineStatus.INFECTED:
      return "INFECTED";
    case QuarantineStatus.ERROR:
    default:
      return "ERROR";
  }
}

/**
 * Update scan status in database
 */
async function updateScanStatus(
  fileId: string,
  status: QuarantineStatus,
  scanResult: VirusScanResult
): Promise<void> {
  await prisma.fileUpload.update({
    where: { id: fileId },
    data: {
      scanStatus: mapQuarantineStatusToScanStatus(status),
      scanResult: {
        ...((await prisma.fileUpload.findUnique({
          where: { id: fileId },
          select: { scanResult: true },
        }))?.scanResult as object || {}),
        scanResult: {
          clean: scanResult.clean,
          threat: scanResult.threat,
          threats: scanResult.threats,
          scannerType: scanResult.scannerType,
          scannedAt: scanResult.scannedAt.toISOString(),
          error: scanResult.error,
        },
      },
      scannedAt: scanResult.scannedAt,
    },
  });
}

// ============================================
// ALERTING & NOTIFICATIONS
// ============================================

/**
 * Alert security team about detected malware
 */
async function alertSecurityTeam(details: {
  fileId: string;
  orgId: string;
  userId: string;
  filename: string;
  threat?: string;
  threats?: string[];
  scannerType: string;
  detectedAt: Date;
}): Promise<void> {
  // Log to structured logging for security monitoring
  console.error(
    JSON.stringify({
      level: "CRITICAL",
      category: "SECURITY",
      event: "MALWARE_DETECTED",
      ...details,
      timestamp: new Date().toISOString(),
    })
  );

  // In production, integrate with:
  // - PagerDuty/OpsGenie for alerting
  // - SIEM systems (Splunk, DataDog, etc.)
  // - Security email distribution list
  // - Slack/Teams security channel

  // Example: Send to security webhook
  const securityWebhook = process.env.SECURITY_ALERT_WEBHOOK_URL;
  if (securityWebhook) {
    try {
      await fetch(securityWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "malware_detected",
          severity: "critical",
          ...details,
        }),
      });
    } catch (error) {
      console.error("[VirusScan] Failed to send security alert:", error);
    }
  }
}

/**
 * Notify user about infected file
 */
async function notifyUserOfInfectedFile(
  userId: string,
  filename: string,
  threat?: string
): Promise<void> {
  // Get user email from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    console.warn(`[VirusScan] Cannot notify user ${userId}: no email found`);
    return;
  }

  // Log notification (actual email sending would use email service)
  console.log(
    `[VirusScan] Notifying user ${user.email} about infected file: ${filename}`
  );

  // In production, integrate with email service:
  // await sendEmail({
  //   to: user.email,
  //   subject: "Security Alert: Uploaded File Rejected",
  //   template: "infected-file-notification",
  //   data: { filename, threat, userName: user.name },
  // });
}

// ============================================
// RETRY & CLEANUP OPERATIONS
// ============================================

/**
 * Retry scanning for files with error status
 *
 * Call this periodically to retry failed scans
 */
export async function retryFailedScans(
  orgId?: string,
  limit: number = 100
): Promise<{ retried: number; failed: number }> {
  const where = {
    scanStatus: "ERROR" as const,
    ...(orgId && { orgId }),
  };

  const errorFiles = await prisma.fileUpload.findMany({
    where,
    take: limit,
    orderBy: { uploadedAt: "asc" },
  });

  let retried = 0;
  let failed = 0;

  for (const file of errorFiles) {
    try {
      await processQuarantinedFile(file.id);
      retried++;
    } catch (error) {
      console.error(`[VirusScan] Retry failed for file ${file.id}:`, error);
      failed++;
    }
  }

  return { retried, failed };
}

/**
 * Clean up old quarantined files
 *
 * Removes files that have been in quarantine too long
 */
export async function cleanupOldQuarantinedFiles(
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): Promise<{ deleted: number }> {
  const cutoffDate = new Date(Date.now() - maxAgeMs);

  // Find old files still in SCANNING status (likely stuck)
  const stuckFiles = await prisma.fileUpload.findMany({
    where: {
      scanStatus: "SCANNING",
      uploadedAt: { lt: cutoffDate },
    },
  });

  let deleted = 0;

  for (const file of stuckFiles) {
    try {
      // Delete from storage
      await secureDelete(S3BucketType.UPLOADS, file.storagePath);

      // Update database
      await prisma.fileUpload.update({
        where: { id: file.id },
        data: {
          scanStatus: "ERROR",
          scanResult: {
            ...((file.scanResult as object) || {}),
            cleanupReason: "Stuck in quarantine too long",
            deletedAt: new Date().toISOString(),
          },
        },
      });

      deleted++;
    } catch (error) {
      console.error(`[VirusScan] Cleanup failed for file ${file.id}:`, error);
    }
  }

  console.log(`[VirusScan] Cleaned up ${deleted} stuck quarantine files`);
  return { deleted };
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Get virus scanning system status
 */
export async function getVirusScanStatus(): Promise<{
  enabled: boolean;
  scannerAvailable: boolean;
  scannerType: string;
  quarantineStats: {
    scanning: number;
    clean: number;
    infected: number;
    error: number;
  };
}> {
  const [scanning, clean, infected, error] = await Promise.all([
    prisma.fileUpload.count({ where: { scanStatus: "SCANNING" } }),
    prisma.fileUpload.count({ where: { scanStatus: "CLEAN" } }),
    prisma.fileUpload.count({ where: { scanStatus: "INFECTED" } }),
    prisma.fileUpload.count({ where: { scanStatus: "ERROR" } }),
  ]);

  let scannerType = "none";
  if (isClamAVConfigured()) {
    scannerType = "clamav";
  } else if (process.env.VIRUS_SCAN_API_URL) {
    scannerType = "external-api";
  } else if (isExternalScannerConfigured()) {
    scannerType = "external-api";
  } else if (VIRUS_SCAN_CONFIG.allowScanBypass) {
    scannerType = "bypass";
  }

  return {
    enabled: isVirusScanEnabled(),
    scannerAvailable: isScannerAvailable() || VIRUS_SCAN_CONFIG.allowScanBypass,
    scannerType,
    quarantineStats: {
      scanning,
      clean,
      infected,
      error,
    },
  };
}
