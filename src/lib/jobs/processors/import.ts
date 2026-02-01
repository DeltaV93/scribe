/**
 * Import Job Processor
 *
 * Handles asynchronous import processing with progress tracking.
 */

import { Job } from "bullmq";
import { executeImportProcessing } from "@/lib/services/imports";
import { registerProcessor } from "../worker";
import { ImportJobData } from "../queue";

/**
 * Process an import job
 */
async function processImport(job: Job<ImportJobData>): Promise<void> {
  const { batchId, orgId, userId, jobProgressId } = job.data;

  console.log(`Processing import job for batch ${batchId}`);

  try {
    await executeImportProcessing({
      batchId,
      orgId,
      userId,
      jobProgressId,
    });

    console.log(`Import completed for batch ${batchId}`);
  } catch (error) {
    console.error(`Import failed for batch ${batchId}:`, error);
    // Re-throw to let BullMQ handle retry logic
    // The executeImportProcessing function already handles marking the job as failed
    throw error;
  }
}

// Register this processor
registerProcessor("import", processImport);
