/**
 * Scheduled Export Runner
 *
 * This processor runs periodically to check for templates due for scheduled export
 * and queues them for processing.
 *
 * This is designed to be run as a cron job (e.g., every minute) or as a repeatable
 * BullMQ job.
 */

import { Job } from "bullmq";
import { getJobQueue, ScheduledExportRunnerData } from "../queue";
import { registerProcessor } from "../worker";
import {
  getTemplatesDueForExport,
  executeScheduledExport,
} from "@/lib/services/exports/scheduling";

/**
 * Process scheduled export check
 *
 * This job:
 * 1. Queries for templates that are due for scheduled export
 * 2. For each template, triggers an export generation
 * 3. Updates the next scheduled run time
 */
async function processScheduledExportRunner(
  job: Job<ScheduledExportRunnerData>
): Promise<void> {
  console.log("[ScheduledExportRunner] Checking for due exports...");

  const errors: string[] = [];
  let triggered = 0;

  // Get templates due for export
  const dueTemplates = await getTemplatesDueForExport();

  console.log(
    `[ScheduledExportRunner] Found ${dueTemplates.length} templates due for export`
  );

  // Process each template
  for (const template of dueTemplates) {
    try {
      console.log(
        `[ScheduledExportRunner] Triggering export for template: ${template.name} (${template.id})`
      );

      const result = await executeScheduledExport(template.id);

      if (result.success) {
        triggered++;
        console.log(
          `[ScheduledExportRunner] Successfully queued export: ${result.exportId}`
        );
      } else {
        errors.push(`Template ${template.id}: ${result.error}`);
        console.error(
          `[ScheduledExportRunner] Failed to trigger export for ${template.id}: ${result.error}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Template ${template.id}: ${errorMessage}`);
      console.error(
        `[ScheduledExportRunner] Error processing template ${template.id}:`,
        error
      );
    }
  }

  console.log(
    `[ScheduledExportRunner] Complete. Checked: ${dueTemplates.length}, Triggered: ${triggered}, Errors: ${errors.length}`
  );
}

/**
 * Register the scheduled export runner as a repeatable job
 *
 * Call this once on server startup to ensure the job runs every minute.
 */
export async function registerScheduledExportRunner(): Promise<void> {
  const queue = getJobQueue();

  // Remove any existing repeatable jobs with this name
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "scheduled-export-runner") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add the repeatable job (runs every minute)
  await queue.add(
    "scheduled-export-runner",
    { type: "scheduled-export-runner" } as ScheduledExportRunnerData,
    {
      repeat: {
        pattern: "* * * * *", // Every minute
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
    }
  );

  console.log("[ScheduledExportRunner] Registered repeatable job (every minute)");
}

/**
 * Manually trigger the scheduled export check
 *
 * Useful for testing or manual intervention.
 */
export async function triggerScheduledExportCheck(): Promise<string> {
  const queue = getJobQueue();

  const job = await queue.add(
    "scheduled-export-runner",
    { type: "scheduled-export-runner" } as ScheduledExportRunnerData,
    {
      removeOnComplete: true,
    }
  );

  return job.id || "unknown";
}

// Register this processor
registerProcessor("scheduled-export-runner", processScheduledExportRunner);
