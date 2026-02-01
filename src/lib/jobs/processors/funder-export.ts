/**
 * Funder Export Job Processor
 *
 * Handles asynchronous export generation with progress tracking.
 */

import { Job } from "bullmq";
import { executeExportGeneration } from "@/lib/services/exports";
import { registerProcessor } from "../worker";
import { FunderExportJobData } from "../queue";

/**
 * Process a funder export job
 */
async function processFunderExport(job: Job<FunderExportJobData>): Promise<void> {
  const {
    exportId,
    templateId,
    orgId,
    userId,
    periodStart,
    periodEnd,
    programIds,
    clientIds,
    jobProgressId,
  } = job.data;

  console.log(`Processing funder export job for export ${exportId}`);

  try {
    // Convert string dates to Date objects
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    // Validate date conversion
    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new Error("Invalid date format in job data");
    }

    // Execute export generation
    await executeExportGeneration({
      exportId,
      templateId,
      orgId,
      userId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      programIds,
      clientIds,
      jobProgressId,
    });

    console.log(`Funder export completed for export ${exportId}`);
  } catch (error) {
    console.error(`Funder export failed for export ${exportId}:`, error);
    // Re-throw to let BullMQ handle retry logic
    // The executeExportGeneration function already handles marking the job as failed
    throw error;
  }
}

// Register this processor
registerProcessor("funder-export", processFunderExport);
