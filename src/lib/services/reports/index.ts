/**
 * Reports Service - Main Entry Point
 *
 * Coordinates all report-related services and provides a unified API.
 */

import { prisma } from "@/lib/db";
import { ReportType, ReportStatus, ReportTemplateStatus, Prisma } from "@prisma/client";
import { getQuestionnaire, validateAnswers, getReportTypes, Questionnaire } from "./questionnaire";
import { suggestMetrics, SuggestMetricsResult } from "./metric-suggestion";
import { getMetricsForReportType, getMetricById, PreBuiltMetric } from "./pre-built-metrics";
import { calculateMetrics, calculateComparison, AggregationContext, MetricResult, DateRange } from "./aggregation";
import { generateNarratives, GenerateNarrativeOptions, NarrativeSection, getDefaultSections } from "./narrative";
import { generateReportPdf, generatePreviewPdf, ReportPdfData, PdfGenerationOptions } from "./pdf-generator";
import { storeReportPdf, storeReportSnapshot, getReportPdfUrl, listReports } from "./storage";
import { logCrossOrgAccess } from "./cross-org-audit";
import { createJobProgress, updateJobProgress, markJobCompleted, markJobFailed } from "@/lib/jobs/progress";
import { getJobQueue } from "@/lib/jobs/queue";

// Re-export types
export type {
  Questionnaire,
  PreBuiltMetric,
  MetricResult,
  NarrativeSection,
  DateRange,
  AggregationContext,
};

export {
  getQuestionnaire,
  validateAnswers,
  getReportTypes,
  getMetricsForReportType,
  getMetricById,
  getDefaultSections,
};

/**
 * Create a new report template
 */
export interface CreateReportTemplateInput {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  type: ReportType;
  questionnaireAnswers: Record<string, unknown>;
  selectedMetricIds: string[];
  sections?: Array<{
    type: string;
    title: string;
    order: number;
  }>;
  funderRequirements?: Record<string, unknown>;
}

export async function createReportTemplate(input: CreateReportTemplateInput) {
  const {
    orgId,
    userId,
    name,
    description,
    type,
    questionnaireAnswers,
    selectedMetricIds,
    sections,
    funderRequirements,
  } = input;

  // Validate questionnaire answers
  const questionnaire = getQuestionnaire(type);
  const validation = validateAnswers(questionnaire, questionnaireAnswers);

  if (!validation.isValid) {
    throw new Error(`Invalid questionnaire answers: ${validation.errors.map((e) => e.message).join(", ")}`);
  }

  // Get the selected metrics
  const metrics = selectedMetricIds.map((id) => {
    const metric = getMetricById(id);
    if (!metric) throw new Error(`Unknown metric: ${id}`);
    return {
      id: metric.id,
      name: metric.name,
      calculation: metric.calculation,
      displayFormat: metric.displayFormat,
    };
  });

  // Create the template
  const template = await prisma.reportTemplate.create({
    data: {
      orgId,
      name,
      description,
      type,
      status: "DRAFT",
      questionnaireAnswers: questionnaireAnswers as unknown as Prisma.InputJsonValue,
      metrics: metrics as unknown as Prisma.InputJsonValue,
      sections: (sections || getDefaultSections(type).map((s, i) => ({
        type: s,
        title: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        order: i,
      }))) as unknown as Prisma.InputJsonValue,
      funderRequirements: funderRequirements ? funderRequirements as unknown as Prisma.InputJsonValue : undefined,
      createdById: userId,
    },
  });

  return template;
}

/**
 * Get AI suggestions for metrics based on questionnaire answers
 */
export async function getMetricSuggestions(
  reportType: ReportType,
  questionnaireAnswers: Record<string, unknown>,
  funderRequirements?: string
): Promise<SuggestMetricsResult> {
  return suggestMetrics({
    reportType,
    questionnaireAnswers,
    funderRequirements,
  });
}

/**
 * Publish a report template
 */
export async function publishReportTemplate(
  templateId: string,
  userId: string,
  orgId: string
) {
  const template = await prisma.reportTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (template.orgId !== orgId) {
    throw new Error("Access denied");
  }

  if (template.status === "PUBLISHED") {
    throw new Error("Template is already published");
  }

  return prisma.reportTemplate.update({
    where: { id: templateId },
    data: {
      status: "PUBLISHED",
      publishedById: userId,
      publishedAt: new Date(),
    },
  });
}

/**
 * Generate a report from a template
 */
export interface GenerateReportInput {
  templateId: string;
  orgId: string;
  userId: string;
  reportingPeriod: DateRange;
  programIds?: string[];
  async?: boolean;
}

export async function generateReport(input: GenerateReportInput): Promise<{
  reportId: string;
  jobId?: string;
}> {
  const { templateId, orgId, userId, reportingPeriod, programIds, async = true } = input;

  // Verify template exists and is published
  const template = await prisma.reportTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (template.orgId !== orgId) {
    // Check for cross-org access
    await logCrossOrgAccess({
      action: "REPORT_GENERATE",
      userId,
      userOrgId: orgId,
      targetOrgId: template.orgId,
      resourceType: "ReportTemplate",
      resourceId: templateId,
    });
  }

  // Create the report record
  const report = await prisma.report.create({
    data: {
      templateId,
      orgId,
      reportingPeriodStart: reportingPeriod.start,
      reportingPeriodEnd: reportingPeriod.end,
      status: "GENERATING",
      generatedById: userId,
    },
  });

  if (async) {
    // Create job and queue it
    const job = await createJobProgress({
      type: "report-generation",
      userId,
      orgId,
      total: 100, // Progress tracked as percentage
      metadata: {
        reportId: report.id,
        templateId,
        reportingPeriod,
        programIds,
      },
    });

    await getJobQueue().add("report-generation", {
      reportId: report.id,
      templateId,
      orgId,
      userId,
      reportingPeriod,
      programIds,
      jobProgressId: job.id,
    });

    return { reportId: report.id, jobId: job.id };
  }

  // Synchronous generation
  await executeReportGeneration({
    reportId: report.id,
    templateId,
    orgId,
    userId,
    reportingPeriod,
    programIds,
  });

  return { reportId: report.id };
}

/**
 * Execute report generation (called by job processor or synchronously)
 */
export async function executeReportGeneration(params: {
  reportId: string;
  templateId: string;
  orgId: string;
  userId: string;
  reportingPeriod: DateRange;
  programIds?: string[];
  jobProgressId?: string;
}): Promise<void> {
  const { reportId, templateId, orgId, userId, reportingPeriod, programIds, jobProgressId } = params;

  try {
    // Get template and org details
    const [template, org, user] = await Promise.all([
      prisma.reportTemplate.findUnique({ where: { id: templateId } }),
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!template || !org) {
      throw new Error("Template or organization not found");
    }

    // Update progress
    if (jobProgressId) {
      await updateJobProgress(jobProgressId, { progress: 10 });
    }

    // Calculate metrics
    const metrics = template.metrics as Array<{
      id: string;
      name: string;
      calculation: unknown;
      displayFormat: string;
    }>;

    const context: AggregationContext = {
      orgId,
      dateRange: reportingPeriod,
      programIds,
    };

    const metricResults: Array<{ metric: PreBuiltMetric; result: MetricResult }> = [];

    for (const metricDef of metrics) {
      const metric = getMetricById(metricDef.id);
      if (metric) {
        const results = await calculateMetrics([metric], context);
        if (results.length > 0) {
          metricResults.push({ metric, result: results[0] });
        }
      }
    }

    if (jobProgressId) {
      await updateJobProgress(jobProgressId, { progress: 40 });
    }

    // Generate narratives
    const sections = template.sections as Array<{
      type: string;
      title: string;
      order: number;
    }>;

    const narrativeOptions: GenerateNarrativeOptions = {
      sectionTypes: sections.map((s) => s.type as never),
      tone: "formal",
      maxWordsPerSection: 300,
      includeDataCitations: true,
      anonymizeClientData: true,
    };

    const narratives = await generateNarratives(
      {
        organizationName: org.name,
        reportType: template.type,
        reportingPeriod,
        metrics: metricResults,
        questionnaireAnswers: template.questionnaireAnswers as Record<string, unknown>,
      },
      narrativeOptions
    );

    if (jobProgressId) {
      await updateJobProgress(jobProgressId, { progress: 70 });
    }

    // Generate PDF
    const pdfData: ReportPdfData = {
      organizationName: org.name,
      reportName: template.name,
      reportType: template.type,
      reportingPeriod,
      generatedAt: new Date(),
      generatedBy: user?.name || user?.email || "Unknown",
      metrics: metricResults,
      narratives,
    };

    const pdfBuffer = await generateReportPdf(pdfData);

    if (jobProgressId) {
      await updateJobProgress(jobProgressId, { progress: 85 });
    }

    // Store PDF
    await storeReportPdf(reportId, orgId, pdfBuffer);

    // Store snapshot
    await storeReportSnapshot(
      reportId,
      {
        metrics: metricResults.map((m) => m.result),
        narratives,
        context,
      },
      "1.0"
    );

    // Update report status
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "COMPLETED",
        generatedAt: new Date(),
        generatedData: metricResults.map((m) => m.result) as unknown as Prisma.InputJsonValue,
        narrativeSections: narratives as unknown as Prisma.InputJsonValue,
      },
    });

    if (jobProgressId) {
      await markJobCompleted(jobProgressId, { reportId });
    }
  } catch (error) {
    console.error("Report generation failed:", error);

    // Update report status
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
      },
    });

    if (jobProgressId) {
      await markJobFailed(
        jobProgressId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    throw error;
  }
}

/**
 * Get report with download URL
 */
export async function getReport(reportId: string, userId: string, userOrgId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
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
  });

  if (!report) {
    throw new Error("Report not found");
  }

  // Check access
  if (report.orgId !== userOrgId) {
    await logCrossOrgAccess({
      action: "REPORT_VIEW",
      userId,
      userOrgId,
      targetOrgId: report.orgId,
      resourceType: "Report",
      resourceId: reportId,
    });
  }

  // Get download URL if completed
  let pdfUrl: string | null = null;
  if (report.status === "COMPLETED" && report.pdfPath) {
    pdfUrl = await getReportPdfUrl(reportId);
  }

  return {
    ...report,
    pdfUrl,
  };
}

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
  const where = {
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
      },
    }),
    prisma.reportTemplate.count({ where }),
  ]);

  return { templates, total };
}

/**
 * Generate preview PDF (anonymized)
 */
export async function generateReportPreview(
  templateId: string,
  orgId: string,
  userId: string,
  reportingPeriod: DateRange
): Promise<Buffer> {
  const [template, org] = await Promise.all([
    prisma.reportTemplate.findUnique({ where: { id: templateId } }),
    prisma.organization.findUnique({ where: { id: orgId } }),
  ]);

  if (!template || !org) {
    throw new Error("Template or organization not found");
  }

  // Generate sample data for preview
  const metrics = template.metrics as Array<{ id: string }>;
  const sampleMetrics: Array<{ metric: PreBuiltMetric; result: MetricResult }> = [];

  for (const metricDef of metrics) {
    const metric = getMetricById(metricDef.id);
    if (metric) {
      sampleMetrics.push({
        metric,
        result: {
          metricId: metric.id,
          value: Math.round(Math.random() * 100),
          formattedValue: "***",
          benchmarkStatus: ["below", "good", "excellent"][Math.floor(Math.random() * 3)] as "below" | "good" | "excellent",
        },
      });
    }
  }

  const pdfData: ReportPdfData = {
    organizationName: org.name,
    reportName: template.name,
    reportType: template.type,
    reportingPeriod,
    generatedAt: new Date(),
    generatedBy: "Preview",
    metrics: sampleMetrics,
    narratives: [
      {
        type: "executive_summary",
        title: "Executive Summary",
        content: "[Preview - Narrative content will be generated when report is finalized]",
        wordCount: 10,
      },
    ],
  };

  return generatePreviewPdf(pdfData);
}

/**
 * Clone a metric for customization
 */
export async function cloneMetric(
  baseMetricId: string,
  orgId: string,
  userId: string,
  customizations: {
    name: string;
    description: string;
    calculation?: Record<string, unknown>;
  }
) {
  const baseMetric = getMetricById(baseMetricId);
  if (!baseMetric) {
    throw new Error("Base metric not found");
  }

  return prisma.customMetric.create({
    data: {
      orgId,
      baseMetricId,
      name: customizations.name,
      description: customizations.description,
      calculation: (customizations.calculation || baseMetric.calculation) as unknown as Prisma.InputJsonValue,
      version: "1.0",
      createdById: userId,
    },
  });
}

/**
 * List custom metrics for an organization
 */
export async function listCustomMetrics(orgId: string) {
  return prisma.customMetric.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });
}
