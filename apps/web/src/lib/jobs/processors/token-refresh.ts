/**
 * Token Refresh Processor (PX-1001 Phase 2)
 *
 * Background job that proactively refreshes OAuth tokens before they expire.
 * Runs hourly to find tokens expiring within the next hour and refreshes them.
 *
 * This prevents users from encountering expired token errors during active use.
 */

import { Job } from "bullmq";
import { getJobQueue, TokenRefreshRunnerData } from "../queue";
import { registerProcessor } from "../worker";
import {
  findExpiringConnections,
  refreshToken,
} from "@/lib/integrations/base/token-refresh";

/**
 * Process token refresh runner
 *
 * This job:
 * 1. Finds all connections with tokens expiring within 1 hour
 * 2. Attempts to refresh each token
 * 3. Logs results and errors
 */
async function processTokenRefreshRunner(
  job: Job<TokenRefreshRunnerData>
): Promise<void> {
  console.log("[TokenRefreshRunner] Starting proactive token refresh check...");

  const startTime = Date.now();
  let refreshed = 0;
  let failed = 0;
  const errors: Array<{ connectionId: string; platform: string; error: string }> = [];

  // Find connections with tokens expiring within 1 hour
  const expiringConnections = await findExpiringConnections(60);

  console.log(
    `[TokenRefreshRunner] Found ${expiringConnections.length} connections with expiring tokens`
  );

  if (expiringConnections.length === 0) {
    console.log("[TokenRefreshRunner] No tokens need refresh");
    return;
  }

  // Refresh each connection
  for (const connection of expiringConnections) {
    try {
      console.log(
        `[TokenRefreshRunner] Refreshing ${connection.platform} token for connection ${connection.id}`
      );

      const result = await refreshToken(connection.id);

      if (result.success) {
        refreshed++;
        console.log(
          `[TokenRefreshRunner] Successfully refreshed ${connection.platform} token for connection ${connection.id}`
        );
      } else {
        failed++;
        errors.push({
          connectionId: connection.id,
          platform: connection.platform,
          error: result.error || "Unknown error",
        });
        console.error(
          `[TokenRefreshRunner] Failed to refresh ${connection.platform} token for connection ${connection.id}: ${result.error}`
        );
      }
    } catch (error) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push({
        connectionId: connection.id,
        platform: connection.platform,
        error: errorMessage,
      });
      console.error(
        `[TokenRefreshRunner] Error refreshing ${connection.platform} token for connection ${connection.id}:`,
        error
      );
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[TokenRefreshRunner] Complete in ${duration}ms. Refreshed: ${refreshed}, Failed: ${failed}`
  );

  if (errors.length > 0) {
    console.warn("[TokenRefreshRunner] Errors:", JSON.stringify(errors, null, 2));
  }
}

/**
 * Register the token refresh runner as a repeatable job
 *
 * Call this once on server startup to ensure the job runs hourly.
 */
export async function registerTokenRefreshRunner(): Promise<void> {
  const queue = getJobQueue();

  // Remove any existing repeatable jobs with this name
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "token-refresh-runner") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add the repeatable job (runs every hour at minute 30)
  await queue.add(
    "token-refresh-runner",
    { type: "token-refresh-runner" } as TokenRefreshRunnerData,
    {
      repeat: {
        pattern: "30 * * * *", // Every hour at :30
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
    }
  );

  console.log("[TokenRefreshRunner] Registered repeatable job (hourly at :30)");
}

/**
 * Manually trigger token refresh check
 *
 * Useful for testing or manual intervention.
 */
export async function triggerTokenRefreshCheck(): Promise<string> {
  const queue = getJobQueue();

  const job = await queue.add(
    "token-refresh-runner",
    { type: "token-refresh-runner" } as TokenRefreshRunnerData,
    {
      removeOnComplete: true,
    }
  );

  return job.id || "unknown";
}

// Register this processor
registerProcessor("token-refresh-runner", processTokenRefreshRunner);
