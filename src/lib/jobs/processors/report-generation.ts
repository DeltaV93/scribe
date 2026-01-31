/**
 * Report Generation Job Processor
 *
 * Handles asynchronous report generation with progress tracking and email distribution.
 */

import { Job } from "bullmq";
import { executeReportGeneration, DateRange } from "@/lib/services/reports";
import { distributeReport } from "@/lib/services/reporting/distribution";
import { registerProcessor } from "../worker";
import { ReportGenerationJobData } from "../queue";
import { prisma } from "@/lib/db";
import { getReportPdfUrl } from "@/lib/services/reports/storage";

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

  // Check if distribution is configured for this template
  try {
    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId },
      select: { questionnaireAnswers: true },
    });

    if (template?.questionnaireAnswers) {
      const answers = template.questionnaireAnswers as Record<string, unknown>;
      const distribution = answers.distribution as {
        enabled: boolean;
        recipients: Array<{ email: string; name?: string; type: "to" | "cc" | "bcc" }>;
        subject?: string;
        message?: string;
        attachPdf: boolean;
      } | undefined;

      if (distribution?.enabled && distribution.recipients?.length > 0) {
        console.log(`Distributing report ${reportId} to ${distribution.recipients.length} recipients`);

        // Get PDF buffer if attaching
        let pdfBuffer: Buffer | undefined;
        if (distribution.attachPdf) {
          const pdfUrl = await getReportPdfUrl(reportId);
          if (pdfUrl) {
            try {
              const response = await fetch(pdfUrl);
              if (response.ok) {
                pdfBuffer = Buffer.from(await response.arrayBuffer());
              }
            } catch (fetchError) {
              console.error("Failed to fetch PDF for distribution:", fetchError);
            }
          }
        }

        const result = await distributeReport({
          reportId,
          orgId,
          settings: {
            enabled: true,
            recipients: distribution.recipients,
            subject: distribution.subject,
            message: distribution.message,
            attachPdf: distribution.attachPdf,
          },
          pdfBuffer,
        });

        if (result.success) {
          console.log(`Report distributed to ${result.emailsSent} recipients`);
        } else {
          console.error(`Distribution errors:`, result.errors);
        }
      }
    }
  } catch (error) {
    // Log but don't fail the job if distribution fails
    console.error("Error during report distribution:", error);
  }
}

// Register this processor
registerProcessor("report-generation", processReportGeneration);
