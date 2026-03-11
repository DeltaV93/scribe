import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  listOrgKeyVersions,
  getOrgDekByVersion,
  getOrCreateOrgDek,
} from "@/lib/encryption";
import { encrypt, decrypt, isEncrypted, encryptJson, decryptJson } from "@/lib/encryption";
import { prisma } from "@/lib/db";
import { logEnhancedAudit } from "@/lib/audit/enhanced-logger";
import { AuditEventType, SecurityAction, AuditSeverity } from "@/lib/audit/events";
import { ENCRYPTED_FIELDS } from "@/lib/encryption/field-encryption";

const BATCH_SIZE = 100;

interface ReEncryptionProgress {
  model: string;
  total: number;
  processed: number;
  failed: number;
  status: "pending" | "processing" | "completed" | "failed";
}

/**
 * POST /api/admin/encryption/re-encrypt
 *
 * Trigger re-encryption of organization data with the new key.
 * This should be called after a key rotation to migrate existing data.
 *
 * IMPORTANT: This is a long-running operation and should typically be
 * run as a background job in production.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { fromVersion, toVersion, models, dryRun = false } = body;

    // Validate versions
    const versions = await listOrgKeyVersions(user.orgId);
    const activeVersion = versions.find((k) => k.isActive);

    if (!activeVersion) {
      return NextResponse.json(
        { error: "No active encryption key found" },
        { status: 400 }
      );
    }

    const sourceVersion = fromVersion || (activeVersion.keyVersion > 1 ? activeVersion.keyVersion - 1 : null);
    const targetVersion = toVersion || activeVersion.keyVersion;

    if (!sourceVersion) {
      return NextResponse.json(
        { error: "No previous key version to migrate from" },
        { status: 400 }
      );
    }

    // Get the keys
    const [sourceKey, targetKey] = await Promise.all([
      getOrgDekByVersion(user.orgId, sourceVersion),
      getOrgDekByVersion(user.orgId, targetVersion),
    ]);

    if (!sourceKey) {
      return NextResponse.json(
        { error: `Source key version ${sourceVersion} not found` },
        { status: 400 }
      );
    }

    if (!targetKey) {
      return NextResponse.json(
        { error: `Target key version ${targetVersion} not found` },
        { status: 400 }
      );
    }

    // Log re-encryption start
    await logEnhancedAudit({
      eventType: AuditEventType.SECURITY,
      action: SecurityAction.RE_ENCRYPTION_STARTED,
      severity: AuditSeverity.CRITICAL,
      orgId: user.orgId,
      userId: user.id,
      resource: "EncryptionKey",
      resourceId: user.orgId,
      details: {
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        dryRun,
        models: models || "all",
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Create job progress record
    const job = await prisma.jobProgress.create({
      data: {
        type: "encryption-key-migration",
        userId: user.id,
        orgId: user.orgId,
        status: "PROCESSING",
        metadata: {
          fromVersion: sourceVersion,
          toVersion: targetVersion,
          dryRun,
          models: models || ["FormSubmission", "Note", "Call", "Message"],
        },
      },
    });

    // For API response, we'll process synchronously but in production
    // this should be a background job
    const results: Record<string, ReEncryptionProgress> = {};
    const modelsToProcess = models || ["FormSubmission", "Note", "Call", "Message"];

    for (const modelName of modelsToProcess) {
      const config = ENCRYPTED_FIELDS[modelName];
      if (!config) {
        results[modelName] = {
          model: modelName,
          total: 0,
          processed: 0,
          failed: 0,
          status: "failed",
        };
        continue;
      }

      try {
        const modelResult = await reEncryptModel(
          modelName,
          config,
          user.orgId,
          sourceKey,
          targetKey,
          dryRun,
          async (progress) => {
            // Update job progress
            await prisma.jobProgress.update({
              where: { id: job.id },
              data: {
                progress: progress.processed,
                total: progress.total,
              },
            });
          }
        );
        results[modelName] = modelResult;
      } catch (modelError) {
        console.error(`Re-encryption failed for ${modelName}:`, modelError);
        results[modelName] = {
          model: modelName,
          total: 0,
          processed: 0,
          failed: 0,
          status: "failed",
        };
      }
    }

    // Calculate totals
    const totalProcessed = Object.values(results).reduce((sum, r) => sum + r.processed, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    const overallStatus = totalFailed === 0 ? "completed" : "completed_with_errors";

    // Update job as completed
    await prisma.jobProgress.update({
      where: { id: job.id },
      data: {
        status: totalFailed === 0 ? "COMPLETED" : "FAILED",
        completed: totalProcessed,
        failed: totalFailed,
        result: JSON.parse(JSON.stringify(results)),
      },
    });

    // Log completion
    await logEnhancedAudit({
      eventType: AuditEventType.SECURITY,
      action: totalFailed === 0 ? SecurityAction.RE_ENCRYPTION_COMPLETED : SecurityAction.RE_ENCRYPTION_FAILED,
      severity: AuditSeverity.CRITICAL,
      orgId: user.orgId,
      userId: user.id,
      resource: "EncryptionKey",
      resourceId: user.orgId,
      details: {
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        dryRun,
        totalProcessed,
        totalFailed,
        results,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      data: {
        jobId: job.id,
        status: overallStatus,
        fromVersion: sourceVersion,
        toVersion: targetVersion,
        dryRun,
        results,
        summary: {
          totalProcessed,
          totalFailed,
        },
      },
    });
  } catch (error) {
    console.error("Error during re-encryption:", error);
    return NextResponse.json(
      { error: "Re-encryption failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/encryption/re-encrypt
 *
 * Get status of re-encryption jobs
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      // Get specific job
      const job = await prisma.jobProgress.findUnique({
        where: { id: jobId },
      });

      if (!job || job.orgId !== user.orgId) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      return NextResponse.json({
        data: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          total: job.total,
          completed: job.completed,
          failed: job.failed,
          result: job.result,
          metadata: job.metadata,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      });
    }

    // Get all re-encryption jobs for this org
    const jobs = await prisma.jobProgress.findMany({
      where: {
        orgId: user.orgId,
        type: "encryption-key-migration",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      data: {
        jobs: jobs.map((job) => ({
          id: job.id,
          status: job.status,
          progress: job.progress,
          total: job.total,
          completed: job.completed,
          failed: job.failed,
          metadata: job.metadata,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching re-encryption status:", error);
    return NextResponse.json(
      { error: "Failed to fetch re-encryption status" },
      { status: 500 }
    );
  }
}

/**
 * Re-encrypt records for a specific model
 */
async function reEncryptModel(
  modelName: string,
  config: { fields: string[]; jsonFields: string[]; orgIdPath: string },
  orgId: string,
  sourceKey: string,
  targetKey: string,
  dryRun: boolean,
  onProgress: (progress: ReEncryptionProgress) => Promise<void>
): Promise<ReEncryptionProgress> {
  const progress: ReEncryptionProgress = {
    model: modelName,
    total: 0,
    processed: 0,
    failed: 0,
    status: "processing",
  };

  // Get records based on model
  let records: Array<{ id: string } & Record<string, unknown>> = [];

  switch (modelName) {
    case "FormSubmission":
      records = await prisma.formSubmission.findMany({
        where: { orgId },
        select: {
          id: true,
          data: true,
          aiExtractedData: true,
        },
      });
      break;
    case "Note":
      records = await prisma.note.findMany({
        where: { client: { orgId } },
        select: {
          id: true,
          content: true,
        },
      });
      break;
    case "Call":
      records = await prisma.call.findMany({
        where: { client: { orgId } },
        select: {
          id: true,
          transcriptRaw: true,
          transcriptJson: true,
          extractedFields: true,
          aiSummary: true,
          confidenceScores: true,
        },
      });
      break;
    case "Message":
      records = await prisma.message.findMany({
        where: { orgId },
        select: {
          id: true,
          content: true,
        },
      });
      break;
    default:
      progress.status = "failed";
      return progress;
  }

  progress.total = records.length;
  await onProgress(progress);

  // Process in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      try {
        const updates: Record<string, unknown> = {};
        let hasChanges = false;

        // Re-encrypt string fields
        for (const field of config.fields) {
          const value = record[field];
          if (typeof value === "string" && isEncrypted(value)) {
            try {
              const decrypted = decrypt(value, sourceKey);
              const reEncrypted = encrypt(decrypted, targetKey);
              updates[field] = reEncrypted;
              hasChanges = true;
            } catch (fieldError) {
              console.warn(`Failed to re-encrypt ${modelName}.${field} for record ${record.id}:`, fieldError);
            }
          }
        }

        // Re-encrypt JSON fields
        for (const field of config.jsonFields) {
          const value = record[field];
          if (typeof value === "string" && isEncrypted(value)) {
            try {
              const decrypted = decryptJson(value, sourceKey);
              const reEncrypted = encryptJson(decrypted, targetKey);
              updates[field] = reEncrypted;
              hasChanges = true;
            } catch (fieldError) {
              console.warn(`Failed to re-encrypt ${modelName}.${field} for record ${record.id}:`, fieldError);
            }
          }
        }

        // Update record if not dry run
        if (hasChanges && !dryRun) {
          switch (modelName) {
            case "FormSubmission":
              await prisma.formSubmission.update({
                where: { id: record.id },
                data: updates,
              });
              break;
            case "Note":
              await prisma.note.update({
                where: { id: record.id },
                data: updates,
              });
              break;
            case "Call":
              await prisma.call.update({
                where: { id: record.id },
                data: updates,
              });
              break;
            case "Message":
              await prisma.message.update({
                where: { id: record.id },
                data: updates,
              });
              break;
          }
        }

        progress.processed++;
      } catch (recordError) {
        console.error(`Failed to process ${modelName} record ${record.id}:`, recordError);
        progress.failed++;
      }
    }

    await onProgress(progress);
  }

  progress.status = progress.failed === 0 ? "completed" : "completed";
  return progress;
}
