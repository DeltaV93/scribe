/**
 * Funder Data Export Service - Main Entry Point
 *
 * Coordinates export template management, data extraction,
 * file generation, and storage.
 */

import { prisma } from "@/lib/db";
import { ExportType, ExportStatus, ExportTemplateStatus, Prisma } from "@prisma/client";
import { createJobProgress, updateJobProgress, markJobCompleted, markJobFailed } from "@/lib/jobs/progress";
import { getJobQueue } from "@/lib/jobs/queue";
import { createGenerator, getFileExtension, getContentType } from "./generators";
import { extractData, extractPreviewData, getExportClientCount } from "./data-extraction";
import { validateRecords, getValidationSummary } from "./validation";
import { uploadExportFile, getExportDownloadUrl } from "./storage";
import {
  FieldMapping,
  CodeMappings,
  OutputConfig,
  GenerateExportParams,
  GenerateExportResult,
  ExportPreview,
  FunderExportJobData,
} from "./types";
import { getPredefinedTemplate } from "./templates/predefined";

// Re-export modules
export * from "./types";
export * from "./templates";
export * from "./generators";
export * from "./data-extraction";
export * from "./validation";
export * from "./storage";
export * from "./scheduling";

// ============================================
// EXPORT GENERATION
// ============================================

/**
 * Generate an export from a template
 */
export async function generateExport(params: GenerateExportParams): Promise<GenerateExportResult> {
  const {
    templateId,
    orgId,
    userId,
    periodStart,
    periodEnd,
    programIds,
    clientIds,
    skipValidation = false,
  } = params;

  // Get template
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  if (template.status !== "ACTIVE") {
    throw new Error("Template must be active to generate exports");
  }

  // Create export record
  const exportRecord = await prisma.funderExport.create({
    data: {
      orgId,
      templateId,
      status: "PENDING",
      periodStart,
      periodEnd,
      programIds: programIds || [],
      clientIds: clientIds || [],
      generatedById: userId,
    },
  });

  // Create job for async processing
  const jobProgress = await createJobProgress({
    type: "funder-export",
    userId,
    orgId,
    total: 100,
    metadata: {
      exportId: exportRecord.id,
      templateId,
      exportType: template.exportType,
    },
  });

  // Queue the job
  const jobData: FunderExportJobData = {
    jobProgressId: jobProgress.id,
    exportId: exportRecord.id,
    templateId,
    orgId,
    userId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    programIds,
    clientIds,
  };

  await getJobQueue().add("funder-export", jobData);

  return {
    exportId: exportRecord.id,
    status: "PENDING",
    recordCount: 0,
  };
}

/**
 * Execute export generation (called by job processor)
 */
export async function executeExportGeneration(params: {
  exportId: string;
  templateId: string;
  orgId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  programIds?: string[];
  clientIds?: string[];
  jobProgressId: string;
}): Promise<void> {
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
  } = params;

  const startTime = Date.now();

  try {
    // Update status to processing
    await prisma.funderExport.update({
      where: { id: exportId },
      data: { status: "PROCESSING" },
    });

    await updateJobProgress(jobProgressId, { progress: 5 });

    // Get template with field mappings
    const template = await prisma.exportTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    const fieldMappings = template.fieldMappings as unknown as FieldMapping[];
    const predefined = getPredefinedTemplate(template.exportType);
    const codeMappings = predefined?.codeMappings || {};
    const outputConfig = (template.outputConfig || {}) as unknown as OutputConfig;

    await updateJobProgress(jobProgressId, { progress: 10 });

    // Extract data
    const extractionResult = await extractData({
      orgId,
      sourceFormIds: template.sourceFormIds,
      fieldMappings,
      codeMappings,
      periodStart,
      periodEnd,
      programIds,
      clientIds,
    });

    await updateJobProgress(jobProgressId, { progress: 50 });

    // Validate records
    const validationResult = validateRecords(
      extractionResult.records,
      template.exportType
    );

    await updateJobProgress(jobProgressId, { progress: 60 });

    // Check if validation passes
    if (!validationResult.isValid) {
      // Update export with validation errors
      await prisma.funderExport.update({
        where: { id: exportId },
        data: {
          status: "VALIDATION_REQUIRED",
          recordCount: extractionResult.records.length,
          validationErrors: validationResult.errors as unknown as Prisma.InputJsonValue,
          warnings: validationResult.warnings as unknown as Prisma.InputJsonValue,
        },
      });

      await markJobCompleted(jobProgressId, {
        status: "validation_required",
        validationResult: getValidationSummary(validationResult),
      });

      return;
    }

    // Generate export file
    const generator = createGenerator(
      template.exportType,
      fieldMappings,
      codeMappings
    );

    const defaultConfig: OutputConfig = {
      delimiter: ",",
      encoding: "utf-8",
      includeHeaders: true,
      lineEnding: "CRLF",
    };

    const fileBuffer = await generator.generate(
      extractionResult.records,
      { ...defaultConfig, ...outputConfig }
    );

    await updateJobProgress(jobProgressId, { progress: 80 });

    // Upload to S3
    const contentType = generator.getContentType();
    const filePath = await uploadExportFile(exportId, orgId, fileBuffer, contentType, {
      exportId,
      orgId,
      templateId,
      exportType: template.exportType,
      recordCount: extractionResult.records.length,
      generatedAt: new Date().toISOString(),
      generatedById: userId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    await updateJobProgress(jobProgressId, { progress: 95 });

    // Update export record
    const processingTimeMs = Date.now() - startTime;

    await prisma.funderExport.update({
      where: { id: exportId },
      data: {
        status: "COMPLETED",
        filePath,
        recordCount: extractionResult.records.length,
        warnings: validationResult.warnings.length > 0
          ? (validationResult.warnings as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        generatedAt: new Date(),
        processingTimeMs,
      },
    });

    await markJobCompleted(jobProgressId, {
      exportId,
      recordCount: extractionResult.records.length,
      processingTimeMs,
    });
  } catch (error) {
    console.error("Export generation failed:", error);

    // Update export status
    await prisma.funderExport.update({
      where: { id: exportId },
      data: {
        status: "FAILED",
        validationErrors: {
          error: error instanceof Error ? error.message : "Unknown error",
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await markJobFailed(
      jobProgressId,
      error instanceof Error ? error.message : "Export generation failed"
    );

    throw error;
  }
}

// ============================================
// PREVIEW
// ============================================

/**
 * Generate a preview of export data
 */
export async function generateExportPreview(
  templateId: string,
  orgId: string,
  periodStart: Date,
  periodEnd: Date,
  limit: number = 10
): Promise<ExportPreview> {
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, orgId },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const fieldMappings = template.fieldMappings as unknown as FieldMapping[];
  const predefined = getPredefinedTemplate(template.exportType);
  const codeMappings = predefined?.codeMappings || {};

  // Extract preview data
  const extractionResult = await extractPreviewData(
    {
      orgId,
      sourceFormIds: template.sourceFormIds,
      fieldMappings,
      codeMappings,
      periodStart,
      periodEnd,
    },
    limit
  );

  // Validate
  const validationResult = validateRecords(
    extractionResult.records,
    template.exportType
  );

  // Format as preview
  const headers = fieldMappings.map((m) => m.externalField);
  const rows = extractionResult.records.map((record) =>
    fieldMappings.map((m) => String(record.data[m.externalField] ?? ""))
  );

  // Get total count
  const totalRecords = await getExportClientCount({
    orgId,
    sourceFormIds: template.sourceFormIds,
    periodStart,
    periodEnd,
  });

  return {
    headers,
    rows,
    totalRecords,
    validationWarnings: validationResult.warnings,
  };
}

// ============================================
// EXPORT RETRIEVAL
// ============================================

/**
 * Get export by ID with download URL
 */
export async function getExport(
  exportId: string,
  orgId: string
): Promise<{
  export: NonNullable<Awaited<ReturnType<typeof prisma.funderExport.findFirst>>>;
  downloadUrl: string | null;
  template: {
    id: string;
    name: string;
    exportType: ExportType;
  };
} | null> {
  const exportRecord = await prisma.funderExport.findFirst({
    where: { id: exportId, orgId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          exportType: true,
        },
      },
      generatedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!exportRecord) {
    return null;
  }

  let downloadUrl: string | null = null;
  if (exportRecord.status === "COMPLETED" && exportRecord.filePath) {
    downloadUrl = await getExportDownloadUrl(exportId, orgId);
  }

  return {
    export: exportRecord,
    downloadUrl,
    template: exportRecord.template,
  };
}

/**
 * List exports for an organization
 */
export async function listExports(
  orgId: string,
  options?: {
    templateId?: string;
    status?: ExportStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{
  exports: Array<{
    id: string;
    status: ExportStatus;
    periodStart: Date;
    periodEnd: Date;
    recordCount: number | null;
    createdAt: Date;
    generatedAt: Date | null;
    template: {
      id: string;
      name: string;
      exportType: ExportType;
    };
    generatedBy: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
  total: number;
}> {
  const where: Prisma.FunderExportWhereInput = {
    orgId,
    ...(options?.templateId && { templateId: options.templateId }),
    ...(options?.status && { status: options.status }),
  };

  const [exports, total] = await Promise.all([
    prisma.funderExport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            exportType: true,
          },
        },
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.funderExport.count({ where }),
  ]);

  return { exports, total };
}

/**
 * Retry a failed export
 */
export async function retryExport(
  exportId: string,
  orgId: string,
  userId: string
): Promise<GenerateExportResult> {
  const exportRecord = await prisma.funderExport.findFirst({
    where: { id: exportId, orgId },
  });

  if (!exportRecord) {
    throw new Error("Export not found");
  }

  if (exportRecord.status !== "FAILED" && exportRecord.status !== "VALIDATION_REQUIRED") {
    throw new Error("Only failed or validation-required exports can be retried");
  }

  // Create new export with same parameters
  return generateExport({
    templateId: exportRecord.templateId,
    orgId,
    userId,
    periodStart: exportRecord.periodStart,
    periodEnd: exportRecord.periodEnd,
    programIds: exportRecord.programIds.length > 0 ? exportRecord.programIds : undefined,
    clientIds: exportRecord.clientIds.length > 0 ? exportRecord.clientIds : undefined,
  });
}
