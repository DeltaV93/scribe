import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/verify";
import { archiveOldAuditLogs, HOT_RETENTION_DAYS } from "@/lib/audit/archival";

/**
 * POST /api/cron/archive-audit-logs - Archive old audit logs to S3
 *
 * This endpoint should be called daily by a cron job.
 * It archives audit logs older than 90 days to S3 cold storage:
 * - Compresses logs as JSONL with gzip
 * - Stores in S3: audit-archives/{orgId}/{year}/{month}.jsonl.gz
 * - Deletes archived logs from the primary database
 *
 * HIPAA Compliance:
 * - Maintains 7-year retention through S3 lifecycle policies
 * - Preserves hash chain integrity across archives
 * - Supports querying archived logs for compliance audits
 *
 * Secured with CRON_SECRET environment variable.
 *
 * @example
 * curl -X POST https://app.scrybe.io/api/cron/archive-audit-logs \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate cron secret with timing-safe comparison
    const verification = verifyCronRequest(request);

    if (!verification.verified) {
      const statusCode = verification.reason === "missing_secret" ? 500 : 401;
      const message =
        verification.reason === "missing_secret"
          ? "Cron not configured"
          : "Invalid cron secret";

      console.warn("[CronArchiveAuditLogs] Authorization failed:", {
        reason: verification.reason,
        ip: verification.clientIp,
      });

      return NextResponse.json(
        { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
        { status: statusCode }
      );
    }

    console.log("[CronArchiveAuditLogs] Starting audit log archival job", {
      ip: verification.clientIp,
      hotRetentionDays: HOT_RETENTION_DAYS,
    });

    // Run the archival process
    const result = await archiveOldAuditLogs();

    // Log the result
    if (result.skippedReason) {
      console.log("[CronArchiveAuditLogs] Archival skipped:", {
        reason: result.skippedReason,
        durationMs: result.durationMs,
      });
    } else if (result.success) {
      console.log("[CronArchiveAuditLogs] Archival completed successfully:", {
        archivedCount: result.archivedCount,
        deletedFromDbCount: result.deletedFromDbCount,
        archivesByOrg: result.archivesByOrg,
        durationMs: result.durationMs,
      });
    } else {
      console.error("[CronArchiveAuditLogs] Archival completed with errors:", {
        archivedCount: result.archivedCount,
        deletedFromDbCount: result.deletedFromDbCount,
        errors: result.errors,
        durationMs: result.durationMs,
      });
    }

    return NextResponse.json({
      success: result.success,
      data: {
        archivedCount: result.archivedCount,
        deletedFromDbCount: result.deletedFromDbCount,
        archivesByOrg: result.archivesByOrg,
        skippedReason: result.skippedReason,
        errors: result.errors.length > 0 ? result.errors : undefined,
        durationMs: result.durationMs,
        hotRetentionDays: HOT_RETENTION_DAYS,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[CronArchiveAuditLogs] Fatal error during archival:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs,
    });

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Audit log archival failed",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/archive-audit-logs - Get archival job status/info
 *
 * Returns information about the archival configuration without
 * actually running the job. Useful for health checks.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate cron secret with timing-safe comparison
    const verification = verifyCronRequest(request);

    if (!verification.verified) {
      const statusCode = verification.reason === "missing_secret" ? 500 : 401;
      const message =
        verification.reason === "missing_secret"
          ? "Cron not configured"
          : "Invalid cron secret";

      return NextResponse.json(
        { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
        { status: statusCode }
      );
    }

    // Check S3 configuration
    const s3Configured = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET_AUDIT_LOGS
    );

    return NextResponse.json({
      success: true,
      data: {
        configured: s3Configured,
        hotRetentionDays: HOT_RETENTION_DAYS,
        s3BucketConfigured: !!process.env.AWS_S3_BUCKET_AUDIT_LOGS,
        archiveKeyPattern: "audit-archives/{orgId}/{year}/{month}.jsonl.gz",
        archiveFormat: "JSONL compressed with gzip",
        scheduledFrequency: "daily",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[CronArchiveAuditLogs] Error getting status:", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get archival status",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
      },
      { status: 500 }
    );
  }
}
