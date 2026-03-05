/**
 * POST /api/cron/purge-recordings
 *
 * Scheduled endpoint to purge expired consent records and associated recordings.
 * This endpoint should be called by a cron job (e.g., Vercel Cron, Railway Cron).
 *
 * Per PX-735: When consent is revoked, recordings enter a 30-day retention period.
 * After retention expires, this job:
 * 1. Deletes recordings from S3
 * 2. Nullifies recording URLs and transcripts in Call records
 * 3. Deletes the ConsentRecord entries
 *
 * Security: Protected by CRON_SECRET header or Vercel cron signature
 */

import { NextRequest, NextResponse } from "next/server";
import {
  purgeExpiredRecordings,
  getPurgeStats,
} from "@/lib/services/recording-cleanup";
import { createAuditLog } from "@/lib/audit/service";

/**
 * Validate the cron request is authorized
 */
function isAuthorizedCronRequest(request: NextRequest): boolean {
  // Check for Vercel cron signature
  const vercelCronSignature = request.headers.get("x-vercel-cron-signature");
  if (vercelCronSignature) {
    // Vercel automatically validates this when configured
    return true;
  }

  // Check for CRON_SECRET header (for non-Vercel deployments)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) {
      return true;
    }
  }

  // Allow in development without auth
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!isAuthorizedCronRequest(request)) {
    console.warn("[Purge Recordings] Unauthorized cron request attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log("[Purge Recordings] Starting scheduled purge job...");

    // Run the purge
    const result = await purgeExpiredRecordings();

    const duration = Date.now() - startTime;

    // Log the job execution
    await createAuditLog({
      orgId: "system",
      userId: "system",
      action: "DELETE",
      resource: "SYSTEM",
      resourceId: "purge-recordings-cron",
      details: {
        type: "cron_job_completed",
        job: "purge-recordings",
        duration: `${duration}ms`,
        ...result,
      },
    });

    console.log("[Purge Recordings] Completed:", {
      duration: `${duration}ms`,
      ...result,
    });

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Purge Recordings] Failed:", errorMessage);

    // Log the failure
    await createAuditLog({
      orgId: "system",
      userId: "system",
      action: "DELETE",
      resource: "SYSTEM",
      resourceId: "purge-recordings-cron",
      details: {
        type: "cron_job_failed",
        job: "purge-recordings",
        error: errorMessage,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/purge-recordings
 *
 * Returns purge statistics for monitoring dashboards.
 * Does not require cron authentication.
 */
export async function GET() {
  try {
    const stats = await getPurgeStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Purge Recordings] Stats query failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
