/**
 * Reporting Service - Main Entry Point
 *
 * Coordinates report templates, scheduling, generation, and distribution.
 */

import { prisma } from "@/lib/db";
import { ReportType, ReportStatus, ReportTemplateStatus, Prisma } from "@prisma/client";
import {
  ReportListOptions,
  ReportListResult,
  ReportSummary,
  ScheduleListResult,
  ScheduleSummary,
  DistributionSettings,
} from "./types";
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByType,
  getTemplatesByFunder,
  getUniqueFunders,
  validateTemplateRequirements,
} from "./templates";
import {
  REPORT_SCHEDULE_PRESETS,
  getSchedulePresets,
  getTimezoneOptions,
  parseCron,
  getNextRunTime,
  describeCron,
  calculateReportingPeriod,
} from "./scheduling";
import { distributeReport, validateRecipients, getSuggestedRecipients } from "./distribution";
import { generateReportExcel } from "./generators/excel-generator";
import { generateReportPdf, getRecommendedPdfOptions } from "./generators/pdf-generator";
import { storeReportPdf, getReportPdfUrl } from "@/lib/services/reports/storage";
import { generateReport as generateReportFromService, getReport as getReportFromService } from "@/lib/services/reports";

// Re-export types
export type * from "./types";

// Re-export template functions
export {
  getAllTemplates,
  getTemplateById,
  getTemplatesByType,
  getTemplatesByFunder,
  getUniqueFunders,
  validateTemplateRequirements,
};

// Re-export scheduling functions
export {
  REPORT_SCHEDULE_PRESETS,
  getSchedulePresets,
  getTimezoneOptions,
  parseCron,
  getNextRunTime,
  describeCron,
  calculateReportingPeriod,
};

// Re-export distribution functions
export { distributeReport, validateRecipients, getSuggestedRecipients };

// Re-export generators
export { generateReportExcel, generateReportPdf, getRecommendedPdfOptions };

// ============================================
// REPORT LISTING
// ============================================

/**
 * List reports for an organization
 */
export async function listReports(
  orgId: string,
  options: ReportListOptions = {}
): Promise<ReportListResult> {
  const { status, templateId, startDate, endDate, limit = 20, offset = 0 } = options;

  const where: Prisma.ReportWhereInput = {
    orgId,
    ...(status && { status }),
    ...(templateId && { templateId }),
    ...(startDate && {
      reportingPeriodStart: { gte: startDate },
    }),
    ...(endDate && {
      reportingPeriodEnd: { lte: endDate },
    }),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        template: {
          select: {
            name: true,
            type: true,
          },
        },
        generatedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  const reportSummaries: ReportSummary[] = reports.map((report) => ({
    id: report.id,
    templateName: report.template.name,
    templateType: report.template.type,
    status: report.status,
    reportingPeriodStart: report.reportingPeriodStart,
    reportingPeriodEnd: report.reportingPeriodEnd,
    generatedAt: report.generatedAt || undefined,
    generatedBy: {
      name: report.generatedBy.name,
      email: report.generatedBy.email,
    },
    pdfUrl: report.pdfPath ? `/api/reports/${report.id}/download` : undefined,
  }));

  return {
    reports: reportSummaries,
    total,
    hasMore: offset + reports.length < total,
  };
}

/**
 * Get a single report by ID
 */
export async function getReportById(reportId: string, orgId: string) {
  return prisma.report.findFirst({
    where: { id: reportId, orgId },
    include: {
      template: true,
      generatedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      snapshots: {
        orderBy: { generatedAt: "desc" },
        take: 1,
      },
    },
  });
}

/**
 * Get report download URL
 */
export async function getReportDownloadUrl(
  reportId: string,
  orgId: string
): Promise<string | null> {
  const report = await prisma.report.findFirst({
    where: { id: reportId, orgId, status: "COMPLETED" },
    select: { pdfPath: true },
  });

  if (!report || !report.pdfPath) {
    return null;
  }

  return getReportPdfUrl(reportId);
}

// ============================================
// REPORT TEMPLATES
// ============================================

/**
 * List report templates for an organization
 */
export async function listReportTemplates(
  orgId: string,
  options?: {
    status?: ReportTemplateStatus;
    type?: ReportType;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.ReportTemplateWhereInput = {
    orgId,
    ...(options?.status && { status: options.status }),
    ...(options?.type && { type: options.type }),
  };

  const [templates, total] = await Promise.all([
    prisma.reportTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        _count: {
          select: { reports: true },
        },
      },
    }),
    prisma.reportTemplate.count({ where }),
  ]);

  return { templates, total };
}

/**
 * Get a single report template by ID
 */
export async function getReportTemplateById(templateId: string, orgId: string) {
  return prisma.reportTemplate.findFirst({
    where: { id: templateId, orgId },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
      publishedBy: {
        select: { name: true, email: true },
      },
    },
  });
}

// ============================================
// SCHEDULED REPORTS
// ============================================

/**
 * Get scheduled report status for an organization
 * Note: Schedule info is stored in ReportTemplate model
 */
export async function getScheduledReports(
  orgId: string
): Promise<ScheduleListResult> {
  // For now, we track schedules via a metadata field or separate table
  // This implementation uses ReportTemplate with schedule metadata
  const templates = await prisma.reportTemplate.findMany({
    where: {
      orgId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      name: true,
      type: true,
      questionnaireAnswers: true,
      createdAt: true,
    },
  });

  // Parse schedule info from questionnaireAnswers (where we store schedule config)
  const schedules: ScheduleSummary[] = templates
    .filter((t) => {
      const answers = t.questionnaireAnswers as Record<string, unknown> | null;
      return answers?.scheduleEnabled === true;
    })
    .map((t) => {
      const answers = t.questionnaireAnswers as Record<string, unknown>;
      const schedule = answers.schedule as Record<string, unknown> | undefined;
      const distribution = answers.distribution as DistributionSettings | undefined;

      return {
        id: t.id,
        templateId: t.id,
        templateName: t.name,
        templateType: t.type,
        enabled: true,
        cronExpression: (schedule?.cronExpression as string) || REPORT_SCHEDULE_PRESETS.MONTHLY_1ST_6AM,
        cronDescription: describeCron(
          (schedule?.cronExpression as string) || REPORT_SCHEDULE_PRESETS.MONTHLY_1ST_6AM
        ),
        timezone: (schedule?.timezone as string) || "America/Los_Angeles",
        lastRunAt: schedule?.lastRunAt ? new Date(schedule.lastRunAt as string) : undefined,
        nextRunAt: schedule?.nextRunAt ? new Date(schedule.nextRunAt as string) : undefined,
        failureCount: (schedule?.failureCount as number) || 0,
        distributionEnabled: distribution?.enabled || false,
        recipientCount: distribution?.recipients?.length || 0,
      };
    });

  return {
    schedules,
    total: schedules.length,
  };
}

/**
 * Update schedule for a report template
 */
export async function updateReportSchedule(
  templateId: string,
  orgId: string,
  scheduleConfig: {
    enabled: boolean;
    cronExpression?: string;
    timezone?: string;
    distributionSettings?: DistributionSettings;
  }
): Promise<{
  success: boolean;
  nextRunAt?: Date;
  error?: string;
}> {
  const template = await prisma.reportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  if (template.status !== "PUBLISHED") {
    return { success: false, error: "Only published templates can be scheduled" };
  }

  // Validate cron expression if provided
  if (scheduleConfig.enabled && scheduleConfig.cronExpression) {
    try {
      parseCron(scheduleConfig.cronExpression);
    } catch (error) {
      return {
        success: false,
        error: `Invalid cron expression: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Calculate next run time
  let nextRunAt: Date | undefined;
  if (scheduleConfig.enabled && scheduleConfig.cronExpression) {
    try {
      nextRunAt = getNextRunTime(
        scheduleConfig.cronExpression,
        scheduleConfig.timezone || "America/Los_Angeles"
      );
    } catch (error) {
      return {
        success: false,
        error: `Could not calculate next run time: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Update template with schedule info in questionnaireAnswers
  const existingAnswers = (template.questionnaireAnswers as Record<string, unknown>) || {};

  const updatedAnswers = {
    ...existingAnswers,
    scheduleEnabled: scheduleConfig.enabled,
    schedule: {
      cronExpression: scheduleConfig.cronExpression,
      timezone: scheduleConfig.timezone || "America/Los_Angeles",
      nextRunAt: nextRunAt?.toISOString(),
      failureCount: 0,
    },
    distribution: scheduleConfig.distributionSettings,
  };

  await prisma.reportTemplate.update({
    where: { id: templateId },
    data: {
      questionnaireAnswers: updatedAnswers as unknown as Prisma.InputJsonValue,
    },
  });

  return { success: true, nextRunAt };
}

// ============================================
// QUICK GENERATION (Wrapper around existing service)
// ============================================

/**
 * Generate a report - wrapper around existing reports service
 */
export async function generateReportAsync(input: {
  templateId: string;
  orgId: string;
  userId: string;
  reportingPeriod: { start: Date; end: Date };
  programIds?: string[];
}) {
  return generateReportFromService({
    templateId: input.templateId,
    orgId: input.orgId,
    userId: input.userId,
    reportingPeriod: input.reportingPeriod,
    programIds: input.programIds,
    async: true,
  });
}

/**
 * Get report with details - wrapper around existing service
 */
export async function getReportWithUrl(
  reportId: string,
  userId: string,
  orgId: string
) {
  return getReportFromService(reportId, userId, orgId);
}
