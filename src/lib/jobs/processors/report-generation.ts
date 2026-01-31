/**
 * Report Generation Job Processor
 *
 * Handles asynchronous report generation with progress tracking.
 */

import { Job } from "bullmq";
import { executeReportGeneration, DateRange } from "@/lib/services/reports";
import { registerProcessor } from "../worker";
import { ReportGenerationJobData } from "../queue";

/**
 * Process a report generation job
 */
async function processReportGeneration(job: Job<ReportGenerationJobData>): Promise<void> {
  const {
    reportId,
    templateId,
    orgId,
    userId,
    reportingPeriod,
    programIds,
    jobProgressId,
  } = job.data;

  console.log(`Processing report generation job for report ${reportId}`);

  // Convert string dates to Date objects if needed
  const dateRange: DateRange = {
    start: typeof reportingPeriod.start === "string"
      ? new Date(reportingPeriod.start)
      : reportingPeriod.start,
    end: typeof reportingPeriod.end === "string"
      ? new Date(reportingPeriod.end)
      : reportingPeriod.end,
  };

  // Execute report generation
  await executeReportGeneration({
    reportId,
    templateId,
    orgId,
    userId,
    reportingPeriod: dateRange,
    programIds,
    jobProgressId,
  });

  console.log(`Report generation completed for report ${reportId}`);
}

// Register this processor
registerProcessor("report-generation", processReportGeneration);
