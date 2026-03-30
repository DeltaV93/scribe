/**
 * Integration Push Queue Service (PX-1002)
 *
 * Handles async dispatch of outputs to external integrations with retry logic.
 * Uses database-backed queue for durability across restarts.
 *
 * Features:
 * - Exponential backoff retry (3 attempts over ~1 hour)
 * - Rate limiting per user (100 pushes/hour)
 * - Multi-destination support (one output to multiple integrations)
 * - Sensitivity check before push
 */

import { PushJobStatus, IntegrationPlatform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getWorkflowServiceAsync } from "./registry";
import { checkOutputSensitivity } from "./sensitivity-check";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit/config";
import type { PushResult, ActionItemDraft, MeetingNotesDraft, PlatformConfig } from "./types";

// ============================================
// Constants
// ============================================

/** Maximum retry attempts before permanent failure */
const MAX_ATTEMPTS = 3;

/** Retry delays in milliseconds (exponential backoff) */
const RETRY_DELAYS = [
  5 * 60 * 1000,    // 5 minutes
  15 * 60 * 1000,   // 15 minutes
  40 * 60 * 1000,   // 40 minutes
  // Total: ~1 hour of retry attempts
];

/** Get rate limit config for integration pushes */
const getPushRateLimitConfig = () => RATE_LIMIT_CONFIGS.integration_push;

// ============================================
// Types
// ============================================

export interface CreatePushJobInput {
  outputId: string;
  platform: IntegrationPlatform;
  userId: string;
  orgId: string;
  destinationConfig?: Prisma.InputJsonValue;
}

export interface PushJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
  errorCode?: "RATE_LIMITED" | "SENSITIVITY_BLOCKED" | "INVALID_OUTPUT" | "PUSH_FAILED";
}

export interface ProcessJobResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
  shouldRetry: boolean;
}

// ============================================
// Queue Operations
// ============================================

/**
 * Create a new push job for an output
 *
 * Validates sensitivity and rate limits before queueing.
 */
export async function createPushJob(input: CreatePushJobInput): Promise<PushJobResult> {
  const { outputId, platform, userId, orgId, destinationConfig } = input;

  // 1. Check rate limit
  const rateLimitResult = await checkRateLimit(
    "integration_push",
    getPushRateLimitConfig(),
    { userId }
  );

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
      errorCode: "RATE_LIMITED",
    };
  }

  // 2. Check sensitivity
  const sensitivityResult = await checkOutputSensitivity(outputId);
  if (!sensitivityResult.canPush) {
    return {
      success: false,
      error: sensitivityResult.reason || "Output contains sensitive content",
      errorCode: "SENSITIVITY_BLOCKED",
    };
  }

  // 3. Verify output exists and is approved
  const output = await prisma.draftedOutput.findUnique({
    where: { id: outputId },
    select: { id: true, status: true, conversationId: true },
  });

  if (!output) {
    return {
      success: false,
      error: "Output not found",
      errorCode: "INVALID_OUTPUT",
    };
  }

  if (output.status !== "APPROVED" && output.status !== "PENDING") {
    return {
      success: false,
      error: `Output cannot be pushed (status: ${output.status})`,
      errorCode: "INVALID_OUTPUT",
    };
  }

  // 4. Create the push job
  const job = await prisma.pushJob.create({
    data: {
      outputId,
      platform,
      userId,
      orgId,
      status: PushJobStatus.PENDING,
      attempt: 1,
      maxAttempts: MAX_ATTEMPTS,
      destinationConfig: destinationConfig ?? Prisma.JsonNull,
    },
  });

  return {
    success: true,
    jobId: job.id,
  };
}

/**
 * Create multiple push jobs for an output (multi-destination)
 */
export async function createMultiDestinationPushJobs(
  outputId: string,
  destinations: Array<{ platform: IntegrationPlatform; config?: Prisma.InputJsonValue }>,
  userId: string,
  orgId: string
): Promise<{ results: PushJobResult[]; successCount: number; failureCount: number }> {
  const results: PushJobResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const destination of destinations) {
    const result = await createPushJob({
      outputId,
      platform: destination.platform,
      userId,
      orgId,
      destinationConfig: destination.config,
    });

    results.push(result);
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return { results, successCount, failureCount };
}

/**
 * Process a single push job
 *
 * Called by the job worker to execute the push.
 */
export async function processPushJob(jobId: string): Promise<ProcessJobResult> {
  // 1. Get and lock the job
  const job = await prisma.pushJob.findUnique({
    where: { id: jobId },
    include: {
      output: {
        include: {
          conversation: {
            select: { orgId: true },
          },
        },
      },
    },
  });

  if (!job) {
    return { success: false, error: "Job not found", shouldRetry: false };
  }

  if (job.status !== PushJobStatus.PENDING) {
    return { success: false, error: `Job not pending (status: ${job.status})`, shouldRetry: false };
  }

  // 2. Mark as processing
  await prisma.pushJob.update({
    where: { id: jobId },
    data: { status: PushJobStatus.PROCESSING },
  });

  try {
    // 3. Get user's access token for the platform
    const userConnection = await prisma.userIntegrationConnection.findFirst({
      where: {
        userId: job.userId,
        platform: job.platform,
        status: "ACTIVE",
      },
      include: {
        integrationToken: true,
      },
    });

    if (!userConnection) {
      throw new Error(`No active ${job.platform} connection for user`);
    }

    // Get decrypted access token
    const accessToken = userConnection.integrationToken?.accessToken;
    if (!accessToken) {
      throw new Error(`No access token found for ${job.platform} connection`);
    }

    // 4. Get the workflow service and push
    const service = await getWorkflowServiceAsync(job.platform as any);

    // Build the draft from output
    const draft = buildDraftFromOutput(job.output);
    const config = (job.destinationConfig as PlatformConfig) ?? {};

    let result: PushResult;

    // Call appropriate push method based on output type
    if (job.output.outputType === "ACTION_ITEM") {
      result = await service.pushActionItem(accessToken, draft as ActionItemDraft, config);
    } else if (job.output.outputType === "MEETING_NOTES" && service.pushMeetingNotes) {
      result = await service.pushMeetingNotes(accessToken, draft as MeetingNotesDraft, config);
    } else {
      throw new Error(`Unsupported output type: ${job.output.outputType}`);
    }

    if (result.success) {
      // 5. Mark as completed
      await prisma.pushJob.update({
        where: { id: jobId },
        data: {
          status: PushJobStatus.COMPLETED,
          completedAt: new Date(),
          externalId: result.externalId,
          externalUrl: result.externalUrl,
        },
      });

      // Update the output with push status
      await prisma.draftedOutput.update({
        where: { id: job.outputId },
        data: {
          status: "PUSHED",
          pushedAt: new Date(),
          externalId: result.externalId,
        },
      });

      return {
        success: true,
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        shouldRetry: false,
      };
    } else {
      throw new Error(result.error || "Push failed");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Determine if we should retry
    const shouldRetry = job.attempt < job.maxAttempts;

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const retryDelay = RETRY_DELAYS[job.attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      const nextRetryAt = new Date(Date.now() + retryDelay);

      await prisma.pushJob.update({
        where: { id: jobId },
        data: {
          status: PushJobStatus.PENDING,
          attempt: job.attempt + 1,
          nextRetryAt,
          error: errorMessage,
        },
      });
    } else {
      // Mark as permanently failed
      await prisma.pushJob.update({
        where: { id: jobId },
        data: {
          status: PushJobStatus.FAILED,
          error: errorMessage,
        },
      });

      // Update output status
      await prisma.draftedOutput.update({
        where: { id: job.outputId },
        data: {
          status: "FAILED",
          pushError: errorMessage,
        },
      });

      // TODO: Send notification to user about failed push
      // await notifyPushFailure(job.userId, job.outputId, job.platform, errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      shouldRetry,
    };
  }
}

/**
 * Get pending jobs ready for processing
 */
export async function getPendingJobs(limit = 10): Promise<string[]> {
  const now = new Date();

  const jobs = await prisma.pushJob.findMany({
    where: {
      status: PushJobStatus.PENDING,
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return jobs.map((j) => j.id);
}

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string) {
  return prisma.pushJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      attempt: true,
      maxAttempts: true,
      externalId: true,
      externalUrl: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

/**
 * Get all jobs for an output
 */
export async function getJobsForOutput(outputId: string) {
  return prisma.pushJob.findMany({
    where: { outputId },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Build a draft object from a DraftedOutput
 */
function buildDraftFromOutput(output: {
  title: string | null;
  content: string;
  metadata: Prisma.JsonValue;
  sourceSnippet: string | null;
  outputType: string;
}): ActionItemDraft | MeetingNotesDraft {
  const metadata = (output.metadata as Record<string, any>) || {};

  if (output.outputType === "ACTION_ITEM") {
    return {
      title: output.title || "Untitled Action Item",
      description: output.content,
      assignee: metadata.assignee,
      dueDate: metadata.dueDate,
      priority: metadata.priority,
      labels: metadata.labels,
      projectId: metadata.projectId,
      teamId: metadata.teamId,
      sourceSnippet: output.sourceSnippet || undefined,
    } as ActionItemDraft;
  }

  // Meeting notes
  return {
    title: output.title || "Meeting Notes",
    content: output.content,
    sections: metadata.sections,
    attendees: metadata.attendees,
    actionItems: metadata.actionItems,
    databaseId: metadata.databaseId,
    parentPageId: metadata.parentPageId,
  } as MeetingNotesDraft;
}

// ============================================
// Job Worker (for background processing)
// ============================================

/**
 * Process all pending jobs
 *
 * This should be called by a background worker (cron job, etc.)
 */
export async function processAllPendingJobs(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const jobIds = await getPendingJobs(50);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const jobId of jobIds) {
    const result = await processPushJob(jobId);
    processed++;

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { processed, succeeded, failed };
}
