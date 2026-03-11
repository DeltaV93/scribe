/**
 * Report Storage Service
 *
 * Manages report storage with tiered retention and compression.
 */

import { prisma } from "@/lib/db";
import { Report, StorageTier, ReportStatus, Prisma } from "@prisma/client";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pako from "pako";

// Lazy-load S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return s3Client;
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "scrybe-reports";

// Retention policies (in days)
const RETENTION_POLICIES = {
  FULL: 365 * 7, // 7 years for full reports (compliance requirement)
  COMPRESSED: 365 * 10, // 10 years for compressed archives
};

export interface StoredReport {
  report: Report;
  pdfUrl?: string;
  dataUrl?: string;
}

/**
 * Store report PDF to S3
 */
export async function storeReportPdf(
  reportId: string,
  orgId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const key = `reports/${orgId}/${reportId}/report.pdf`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
    Metadata: {
      reportId,
      orgId,
      storedAt: new Date().toISOString(),
    },
  });

  await getS3Client().send(command);

  // Update report with PDF path
  await prisma.report.update({
    where: { id: reportId },
    data: { pdfPath: key },
  });

  return key;
}

/**
 * Store report data snapshot
 */
export async function storeReportSnapshot(
  reportId: string,
  data: Record<string, unknown>,
  metricsVersion: string
): Promise<void> {
  await prisma.reportSnapshot.create({
    data: {
      reportId,
      dataSnapshot: data as unknown as Prisma.InputJsonValue,
      metricsVersion,
    },
  });
}

/**
 * Get signed URL for report PDF download
 */
export async function getReportPdfUrl(reportId: string): Promise<string | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { pdfPath: true },
  });

  if (!report?.pdfPath) {
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: report.pdfPath,
  });

  // URL valid for 1 hour
  return getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
}

/**
 * Compress report for long-term storage
 */
export async function compressReport(reportId: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      snapshots: true,
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  if (report.storageTier === "COMPRESSED") {
    return; // Already compressed
  }

  // Compress the generated data
  const dataToCompress = {
    generatedData: report.generatedData,
    narrativeSections: report.narrativeSections,
    snapshots: report.snapshots.map((s) => ({
      dataSnapshot: s.dataSnapshot,
      metricsVersion: s.metricsVersion,
      generatedAt: s.generatedAt,
    })),
  };

  const jsonString = JSON.stringify(dataToCompress);
  const compressed = pako.deflate(jsonString);
  const compressedBuffer = Buffer.from(compressed);

  // Store compressed data
  const key = `reports/${report.orgId}/${reportId}/data.gz`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: compressedBuffer,
    ContentType: "application/gzip",
    Metadata: {
      reportId,
      orgId: report.orgId,
      compressedAt: new Date().toISOString(),
      originalSize: String(jsonString.length),
      compressedSize: String(compressedBuffer.length),
    },
  });

  await getS3Client().send(command);

  // Update report to compressed tier and clear inline data
  await prisma.report.update({
    where: { id: reportId },
    data: {
      storageTier: "COMPRESSED",
      // Keep the data for now - it can be cleared in a separate process
    },
  });
}

/**
 * Decompress report data for viewing
 */
export async function decompressReportData(
  reportId: string
): Promise<Record<string, unknown> | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { storageTier: true, orgId: true, generatedData: true },
  });

  if (!report) {
    return null;
  }

  // If still full tier, return inline data
  if (report.storageTier === "FULL" && report.generatedData) {
    return report.generatedData as Record<string, unknown>;
  }

  // Fetch compressed data from S3
  const key = `reports/${report.orgId}/${reportId}/data.gz`;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await getS3Client().send(command);

    if (!response.Body) {
      return null;
    }

    const compressedData = await response.Body.transformToByteArray();
    const decompressed = pako.inflate(compressedData, { to: "string" });

    return JSON.parse(decompressed);
  } catch (error) {
    console.error("Error decompressing report data:", error);
    return null;
  }
}

/**
 * Run retention policy to archive/delete old reports
 */
export async function runRetentionPolicy(orgId?: string): Promise<{
  compressed: number;
  deleted: number;
}> {
  const now = new Date();
  let compressed = 0;
  let deleted = 0;

  // Find reports that should be compressed (older than 1 year, still FULL tier)
  const compressionThreshold = new Date(now);
  compressionThreshold.setDate(compressionThreshold.getDate() - 365);

  const reportsToCompress = await prisma.report.findMany({
    where: {
      ...(orgId && { orgId }),
      storageTier: "FULL",
      status: "COMPLETED",
      generatedAt: {
        lt: compressionThreshold,
      },
    },
    select: { id: true },
  });

  for (const report of reportsToCompress) {
    try {
      await compressReport(report.id);
      compressed++;
    } catch (error) {
      console.error(`Error compressing report ${report.id}:`, error);
    }
  }

  // Find reports that should be deleted (older than retention period)
  const deletionThreshold = new Date(now);
  deletionThreshold.setDate(deletionThreshold.getDate() - RETENTION_POLICIES.COMPRESSED);

  const reportsToDelete = await prisma.report.findMany({
    where: {
      ...(orgId && { orgId }),
      generatedAt: {
        lt: deletionThreshold,
      },
    },
    select: { id: true, pdfPath: true, orgId: true },
  });

  for (const report of reportsToDelete) {
    try {
      // Delete S3 objects
      if (report.pdfPath) {
        await deleteS3Object(report.pdfPath);
      }
      await deleteS3Object(`reports/${report.orgId}/${report.id}/data.gz`);

      // Delete database records
      await prisma.reportSnapshot.deleteMany({
        where: { reportId: report.id },
      });
      await prisma.report.delete({
        where: { id: report.id },
      });

      deleted++;
    } catch (error) {
      console.error(`Error deleting report ${report.id}:`, error);
    }
  }

  return { compressed, deleted };
}

async function deleteS3Object(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await getS3Client().send(command);
  } catch (error) {
    // Ignore errors for non-existent objects
    console.warn(`Could not delete S3 object ${key}:`, error);
  }
}

/**
 * Get storage statistics for an organization
 */
export async function getStorageStats(orgId: string): Promise<{
  totalReports: number;
  fullTierReports: number;
  compressedReports: number;
  totalSnapshots: number;
  oldestReport?: Date;
  newestReport?: Date;
}> {
  const [totalReports, fullTierReports, compressedReports, totalSnapshots, oldestReport, newestReport] =
    await Promise.all([
      prisma.report.count({ where: { orgId } }),
      prisma.report.count({ where: { orgId, storageTier: "FULL" } }),
      prisma.report.count({ where: { orgId, storageTier: "COMPRESSED" } }),
      prisma.reportSnapshot.count({
        where: { report: { orgId } },
      }),
      prisma.report.findFirst({
        where: { orgId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.report.findFirst({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  return {
    totalReports,
    fullTierReports,
    compressedReports,
    totalSnapshots,
    oldestReport: oldestReport?.createdAt,
    newestReport: newestReport?.createdAt,
  };
}

/**
 * List reports for an organization
 */
export async function listReports(
  orgId: string,
  options?: {
    status?: ReportStatus;
    templateId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  reports: Report[];
  total: number;
}> {
  const where = {
    orgId,
    ...(options?.status && { status: options.status }),
    ...(options?.templateId && { templateId: options.templateId }),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        template: {
          select: {
            name: true,
            type: true,
          },
        },
        generatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, total };
}
