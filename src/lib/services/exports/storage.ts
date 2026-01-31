/**
 * Export Storage Service
 *
 * Manages storage of export files in S3.
 */

import { prisma } from "@/lib/db";
import { ExportType, ExportStatus } from "@prisma/client";
import {
  getS3Client,
  getBucketName,
  isS3Configured,
} from "@/lib/storage/s3";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ExportFileMetadata } from "./types";

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate S3 key for an export file
 */
export function getExportKey(
  orgId: string,
  exportId: string,
  filename: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `exports/${orgId}/${year}/${month}/${exportId}/${filename}`;
}

/**
 * Get filename for export based on type and date
 */
export function getExportFilename(
  exportType: ExportType,
  periodStart: Date,
  periodEnd: Date,
  extension: string
): string {
  const startStr = periodStart.toISOString().split("T")[0];
  const endStr = periodEnd.toISOString().split("T")[0];
  const typeStr = exportType.toLowerCase().replace(/_/g, "-");

  return `${typeStr}_export_${startStr}_to_${endStr}.${extension}`;
}

// ============================================
// UPLOAD
// ============================================

/**
 * Upload export file to S3
 */
export async function uploadExportFile(
  exportId: string,
  orgId: string,
  fileBuffer: Buffer,
  contentType: string,
  metadata: ExportFileMetadata
): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const filename = getExportFilename(
    metadata.exportType,
    new Date(metadata.periodStart),
    new Date(metadata.periodEnd),
    getExtensionFromContentType(contentType)
  );

  const key = getExportKey(orgId, exportId, filename);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // Server-side encryption with AWS KMS for HIPAA compliance
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.AWS_KMS_KEY_ARN,
      ContentDisposition: `attachment; filename="${filename}"`,
      Metadata: {
        "export-id": exportId,
        "org-id": orgId,
        "template-id": metadata.templateId,
        "export-type": metadata.exportType,
        "record-count": String(metadata.recordCount),
        "generated-at": metadata.generatedAt,
        "generated-by": metadata.generatedById,
        "period-start": metadata.periodStart,
        "period-end": metadata.periodEnd,
      },
    })
  );

  // Update export record with file path
  await prisma.funderExport.update({
    where: { id: exportId },
    data: { filePath: key },
  });

  return key;
}

/**
 * Get extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "text/csv":
      return "csv";
    case "text/plain":
      return "txt";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "xlsx";
    case "application/xml":
    case "text/xml":
      return "xml";
    default:
      return "dat";
  }
}

// ============================================
// DOWNLOAD
// ============================================

/**
 * Get signed URL for export file download
 */
export async function getExportDownloadUrl(
  exportId: string,
  orgId: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const exportRecord = await prisma.funderExport.findFirst({
    where: {
      id: exportId,
      orgId,
    },
    select: { filePath: true, status: true },
  });

  if (!exportRecord?.filePath) {
    return null;
  }

  if (exportRecord.status !== "COMPLETED") {
    return null;
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: exportRecord.filePath,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Download export file as buffer
 */
export async function downloadExportFile(
  exportId: string,
  orgId: string
): Promise<Buffer | null> {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured");
  }

  const exportRecord = await prisma.funderExport.findFirst({
    where: {
      id: exportId,
      orgId,
    },
    select: { filePath: true },
  });

  if (!exportRecord?.filePath) {
    return null;
  }

  const client = getS3Client();
  const bucket = getBucketName();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: exportRecord.filePath,
    })
  );

  if (!response.Body) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

// ============================================
// DELETE
// ============================================

/**
 * Delete export file from S3
 */
export async function deleteExportFile(
  exportId: string,
  orgId: string
): Promise<boolean> {
  if (!isS3Configured()) {
    return false;
  }

  const exportRecord = await prisma.funderExport.findFirst({
    where: {
      id: exportId,
      orgId,
    },
    select: { filePath: true },
  });

  if (!exportRecord?.filePath) {
    return false;
  }

  const client = getS3Client();
  const bucket = getBucketName();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: exportRecord.filePath,
      })
    );

    // Clear file path in database
    await prisma.funderExport.update({
      where: { id: exportId },
      data: { filePath: null },
    });

    return true;
  } catch (error) {
    console.error("Error deleting export file:", error);
    return false;
  }
}

// ============================================
// RETENTION
// ============================================

// Export files are retained for 7 years per compliance requirements
const EXPORT_RETENTION_DAYS = 365 * 7;

/**
 * Run retention policy to delete old export files
 */
export async function runExportRetentionPolicy(orgId?: string): Promise<{
  deleted: number;
  errors: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - EXPORT_RETENTION_DAYS);

  const exportsToDelete = await prisma.funderExport.findMany({
    where: {
      ...(orgId && { orgId }),
      createdAt: { lt: cutoffDate },
      filePath: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      filePath: true,
    },
  });

  let deleted = 0;
  let errors = 0;

  for (const exportRecord of exportsToDelete) {
    try {
      const success = await deleteExportFile(exportRecord.id, exportRecord.orgId);
      if (success) {
        deleted++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`Error deleting export ${exportRecord.id}:`, error);
      errors++;
    }
  }

  return { deleted, errors };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get export storage statistics for an organization
 */
export async function getExportStorageStats(orgId: string): Promise<{
  totalExports: number;
  completedExports: number;
  failedExports: number;
  exportsWithFiles: number;
  oldestExport?: Date;
  newestExport?: Date;
  byType: Record<ExportType, number>;
}> {
  const [
    totalExports,
    completedExports,
    failedExports,
    exportsWithFiles,
    oldestExport,
    newestExport,
    byTypeResults,
  ] = await Promise.all([
    prisma.funderExport.count({ where: { orgId } }),
    prisma.funderExport.count({ where: { orgId, status: "COMPLETED" } }),
    prisma.funderExport.count({ where: { orgId, status: "FAILED" } }),
    prisma.funderExport.count({ where: { orgId, filePath: { not: null } } }),
    prisma.funderExport.findFirst({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.funderExport.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.funderExport.groupBy({
      by: ["templateId"],
      where: { orgId },
      _count: true,
    }),
  ]);

  // Get template types for the byType counts
  const templateIds = byTypeResults.map((r) => r.templateId);
  const templates = await prisma.exportTemplate.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, exportType: true },
  });

  const templateTypeMap = new Map(templates.map((t) => [t.id, t.exportType]));

  const byType: Record<ExportType, number> = {
    CAP60: 0,
    DOL_WIPS: 0,
    CALI_GRANTS: 0,
    HUD_HMIS: 0,
    CUSTOM: 0,
  };

  for (const result of byTypeResults) {
    const exportType = templateTypeMap.get(result.templateId);
    if (exportType) {
      byType[exportType] += result._count;
    }
  }

  return {
    totalExports,
    completedExports,
    failedExports,
    exportsWithFiles,
    oldestExport: oldestExport?.createdAt,
    newestExport: newestExport?.createdAt,
    byType,
  };
}
