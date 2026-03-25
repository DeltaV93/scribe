/**
 * POST /api/cron/stale-recordings
 *
 * Scheduled endpoint to detect and mark stuck/orphaned recordings.
 * This endpoint should be called by a cron job every 5 minutes.
 *
 * Per PX-RECOVERY: Detects conversations stuck in RECORDING status
 * with stale heartbeats (>15 min) and sets appropriate recovery status.
 *
 * Security: Protected by CRON_SECRET header or Vercel cron signature
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { objectExists, S3BucketType } from "@/lib/storage/secure-s3";
import { generateRecordingKey } from "@/lib/recording";
import { createAuditLog } from "@/lib/audit/service";
import type { RecoveryStatus } from "@prisma/client";

// How long without heartbeat before considering stale (in minutes)
const STALE_THRESHOLD_MINUTES = 15;

// How long presigned URLs are valid (in minutes)
const PRESIGNED_URL_VALIDITY_MINUTES = 60;

/**
 * Validate the cron request is authorized
 */
function isAuthorizedCronRequest(request: NextRequest): boolean {
  // Check for Vercel cron signature
  const vercelCronSignature = request.headers.get("x-vercel-cron-signature");
  if (vercelCronSignature) {
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

interface StaleRecordingResult {
  conversationId: string;
  recoveryStatus: RecoveryStatus;
  hasRecording: boolean;
  lastHeartbeat: Date | null;
  startedAt: Date;
}

export async function POST(request: NextRequest) {
  // Verify authorization
  if (!isAuthorizedCronRequest(request)) {
    console.warn("[Stale Recordings] Unauthorized cron request attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: StaleRecordingResult[] = [];
  let errors: string[] = [];

  try {
    console.log("[Stale Recordings] Starting stale recording detection...");

    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
    const presignedUrlThreshold = new Date(Date.now() - PRESIGNED_URL_VALIDITY_MINUTES * 60 * 1000);

    // Find conversations stuck in RECORDING status with stale heartbeat
    // OR without any heartbeat but created more than threshold ago
    const staleConversations = await prisma.conversation.findMany({
      where: {
        status: "RECORDING",
        recoveryStatus: null, // Not already processed
        OR: [
          // Has heartbeat but it's stale
          {
            lastHeartbeat: {
              lt: staleThreshold,
            },
          },
          // Never had heartbeat and created more than threshold ago
          {
            lastHeartbeat: null,
            createdAt: {
              lt: staleThreshold,
            },
          },
        ],
      },
      select: {
        id: true,
        orgId: true,
        createdById: true,
        recordingUrl: true,
        lastHeartbeat: true,
        startedAt: true,
        createdAt: true,
        title: true,
      },
      take: 100, // Process max 100 per run to avoid timeout
    });

    console.log(`[Stale Recordings] Found ${staleConversations.length} stale recordings`);

    for (const conversation of staleConversations) {
      try {
        let hasRecording = false;
        let recoveryStatus: RecoveryStatus;

        // Check if recording exists in S3
        if (conversation.recordingUrl) {
          // Recording URL is already set - check if it exists
          try {
            hasRecording = await objectExists(
              S3BucketType.RECORDINGS,
              conversation.recordingUrl
            );
          } catch {
            // Assume exists if URL is set but check fails
            hasRecording = true;
          }
        } else {
          // Check expected key pattern
          const expectedKey = generateRecordingKey(
            conversation.orgId,
            conversation.id,
            "webm"
          );
          try {
            hasRecording = await objectExists(S3BucketType.RECORDINGS, expectedKey);

            // If recording exists, update the recordingUrl field
            if (hasRecording) {
              await prisma.conversation.update({
                where: { id: conversation.id },
                data: { recordingUrl: expectedKey },
              });
            }
          } catch {
            // S3 check failed, assume no recording
          }
        }

        // Determine recovery status
        if (hasRecording) {
          recoveryStatus = "RECOVERABLE";
        } else if (conversation.createdAt > presignedUrlThreshold) {
          // Presigned URL might still be valid
          recoveryStatus = "AWAITING_UPLOAD";
        } else {
          // Presigned URL has expired
          recoveryStatus = "EXPIRED";
        }

        // Update conversation with recovery status
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { recoveryStatus },
        });

        results.push({
          conversationId: conversation.id,
          recoveryStatus,
          hasRecording,
          lastHeartbeat: conversation.lastHeartbeat,
          startedAt: conversation.startedAt,
        });

        console.log(
          `[Stale Recordings] Marked conversation ${conversation.id} as ${recoveryStatus}. ` +
          `Has recording: ${hasRecording}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Conversation ${conversation.id}: ${errorMessage}`);
        console.error(`[Stale Recordings] Error processing ${conversation.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    // Summary stats
    const stats = {
      total: staleConversations.length,
      processed: results.length,
      errors: errors.length,
      recoverable: results.filter((r) => r.recoveryStatus === "RECOVERABLE").length,
      awaitingUpload: results.filter((r) => r.recoveryStatus === "AWAITING_UPLOAD").length,
      expired: results.filter((r) => r.recoveryStatus === "EXPIRED").length,
    };

    // Log the job execution
    await createAuditLog({
      orgId: "system",
      userId: "system",
      action: "UPDATE",
      resource: "SYSTEM",
      resourceId: "stale-recordings-cron",
      details: {
        type: "cron_job_completed",
        job: "stale-recordings",
        duration: `${duration}ms`,
        ...stats,
      },
    });

    console.log("[Stale Recordings] Completed:", {
      duration: `${duration}ms`,
      ...stats,
    });

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ...stats,
      results: results.map((r) => ({
        id: r.conversationId,
        status: r.recoveryStatus,
        hasRecording: r.hasRecording,
      })),
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Stale Recordings] Failed:", errorMessage);

    // Log the failure
    await createAuditLog({
      orgId: "system",
      userId: "system",
      action: "UPDATE",
      resource: "SYSTEM",
      resourceId: "stale-recordings-cron",
      details: {
        type: "cron_job_failed",
        job: "stale-recordings",
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
 * GET /api/cron/stale-recordings
 *
 * Returns stats about stuck recordings for monitoring dashboards.
 * Does not require cron authentication.
 */
export async function GET() {
  try {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    // Count conversations in RECORDING status by recovery status
    const [
      totalStuck,
      recoverable,
      awaitingUpload,
      expired,
      activeRecordings,
    ] = await Promise.all([
      prisma.conversation.count({
        where: {
          status: "RECORDING",
          OR: [
            { lastHeartbeat: { lt: staleThreshold } },
            { lastHeartbeat: null, createdAt: { lt: staleThreshold } },
          ],
        },
      }),
      prisma.conversation.count({
        where: { status: "RECORDING", recoveryStatus: "RECOVERABLE" },
      }),
      prisma.conversation.count({
        where: { status: "RECORDING", recoveryStatus: "AWAITING_UPLOAD" },
      }),
      prisma.conversation.count({
        where: { status: "RECORDING", recoveryStatus: "EXPIRED" },
      }),
      prisma.conversation.count({
        where: {
          status: "RECORDING",
          lastHeartbeat: { gte: staleThreshold },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        staleThresholdMinutes: STALE_THRESHOLD_MINUTES,
        totalStuck,
        recoverable,
        awaitingUpload,
        expired,
        activeRecordings,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Stale Recordings] Stats query failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
