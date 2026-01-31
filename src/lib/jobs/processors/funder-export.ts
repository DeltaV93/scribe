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

  // Convert string dates to Date objects
  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

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
}

// Register this processor
registerProcessor("funder-export", processFunderExport);
