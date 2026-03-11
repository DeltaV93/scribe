/**
 * Import Service - Main Entry Point
 *
 * Coordinates file parsing, field mapping, duplicate detection,
 * and record import execution.
 */

import { prisma } from "@/lib/db";
import { ImportStatus, ImportRecordStatus, DuplicateAction, Prisma } from "@prisma/client";
import { createJobProgress, updateJobProgress, markJobCompleted, markJobFailed } from "@/lib/jobs/progress";
import { getJobQueue } from "@/lib/jobs/queue";
import { parseFile, analyzeColumns } from "./file-parser";
import { generateAIMappings, transformValue, getMappingSuggestions } from "./ai-field-mapper";
import { checkForDuplicates, getDuplicateSummary } from "./duplicate-detector";
import {
  ImportFieldMapping,
  DuplicateSettings,
  ImportPreview,
  ImportExecutionResult,
  RollbackResult,
  SCRYBE_CLIENT_FIELDS,
  DEFAULT_DUPLICATE_SETTINGS,
} from "./types";
import type { ImportJobData } from "@/lib/jobs/queue";

// Re-export modules
export * from "./types";
export * from "./file-parser";
export * from "./ai-field-mapper";
export * from "./duplicate-detector";

// ============================================
// BATCH CREATION
// ============================================

/**
 * Create an import batch from an uploaded file
 */
export async function createImportBatch(params: {
  orgId: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileBuffer: Buffer;
}): Promise<{
  batchId: string;
  columns: string[];
  preview: Record<string, unknown>[];
  totalRows: number;
  suggestedMappings: ImportFieldMapping[];
  errors: string[];
}> {
  const { orgId, userId, fileName, filePath, fileSize, fileBuffer } = params;

  // Parse the file
  const parsed = await parseFile(fileBuffer, fileName);

  if (parsed.errors.some((e) => e.severity === "error")) {
    return {
      batchId: "",
      columns: [],
      preview: [],
      totalRows: 0,
      suggestedMappings: [],
      errors: parsed.errors.filter((e) => e.severity === "error").map((e) => e.message),
    };
  }

  // Generate AI-powered mapping suggestions
  let suggestedMappings: ImportFieldMapping[] = [];
  try {
    const aiResult = await generateAIMappings({
      columns: parsed.columns,
      sampleData: parsed.preview,
      targetFields: SCRYBE_CLIENT_FIELDS,
    });
    suggestedMappings = aiResult.mappings;
  } catch (error) {
    console.error("AI mapping failed, using rule-based:", error);
    const suggestions = await getMappingSuggestions(
      parsed.columns,
      parsed.preview,
      SCRYBE_CLIENT_FIELDS
    );
    suggestedMappings = suggestions
      .filter((s) => s.suggestions.length > 0)
      .map((s) => ({
        sourceColumn: s.sourceColumn,
        targetField: s.suggestions[0].targetField,
        confidence: s.suggestions[0].confidence,
        aiSuggested: false,
      }));
  }

  // Create batch record
  const batch = await prisma.importBatch.create({
    data: {
      orgId,
      status: "MAPPING",
      fileName,
      filePath,
      fileSize,
      totalRows: parsed.totalRows,
      detectedColumns: parsed.columns,
      previewData: parsed.preview as unknown as Prisma.InputJsonValue,
      suggestedMappings: suggestedMappings as unknown as Prisma.InputJsonValue,
      uploadedById: userId,
    },
  });

  return {
    batchId: batch.id,
    columns: parsed.columns,
    preview: parsed.preview,
    totalRows: parsed.totalRows,
    suggestedMappings,
    errors: parsed.errors.map((e) => e.message),
  };
}

// ============================================
// PREVIEW
// ============================================

/**
 * Generate import preview with mapped data and duplicate detection
 */
export async function generateImportPreview(
  batchId: string,
  orgId: string,
  fieldMappings: ImportFieldMapping[],
  duplicateSettings: DuplicateSettings = DEFAULT_DUPLICATE_SETTINGS
): Promise<ImportPreview> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, orgId },
  });

  if (!batch) {
    throw new Error("Batch not found");
  }

  const previewData = (batch.previewData as unknown as Record<string, unknown>[]) || [];

  // Map and validate each row
  const records = previewData.map((row, idx) => ({
    rowNumber: idx + 1,
    sourceData: row,
  }));

  // Check for duplicates
  const duplicateResults = await checkForDuplicates(
    orgId,
    records,
    fieldMappings,
    duplicateSettings
  );

  // Generate preview with mapped data
  const preview = duplicateResults.map((result) => {
    const mappedData: Record<string, unknown> = {};
    const validationErrors: string[] = [];

    for (const mapping of fieldMappings) {
      const value = result.sourceData[mapping.sourceColumn];
      const transformed = transformValue(value, mapping.transformer);
      mappedData[mapping.targetField] = transformed;

      // Validate required fields
      if (mapping.required && (transformed === undefined || transformed === "" || transformed === null)) {
        validationErrors.push(`${mapping.targetField} is required`);
      }
    }

    return {
      rowNumber: result.rowNumber,
      sourceData: result.sourceData,
      mappedData,
      duplicates: result.matches,
      validationErrors,
      suggestedAction: result.suggestedAction,
    };
  });

  // Calculate summary
  const summary = {
    newRecords: preview.filter((p) => p.suggestedAction === "CREATE_NEW").length,
    potentialUpdates: preview.filter((p) => p.suggestedAction === "UPDATE").length,
    potentialDuplicates: preview.filter((p) => p.duplicates.length > 0).length,
    validationErrors: preview.filter((p) => p.validationErrors.length > 0).length,
  };

  // Update batch status
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "READY",
      fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
      duplicateSettings: duplicateSettings as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    totalRows: batch.totalRows || 0,
    columns: batch.detectedColumns,
    preview,
    summary,
  };
}

// ============================================
// EXECUTION
// ============================================

/**
 * Execute the import
 */
export async function executeImport(params: {
  batchId: string;
  orgId: string;
  userId: string;
  fieldMappings: ImportFieldMapping[];
  duplicateSettings: DuplicateSettings;
  duplicateResolutions?: Record<number, { action: DuplicateAction; selectedMatchId?: string }>;
}): Promise<{ jobProgressId: string; batchId: string }> {
  const { batchId, orgId, userId, fieldMappings, duplicateSettings, duplicateResolutions } = params;

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, orgId },
  });

  if (!batch) {
    throw new Error("Batch not found");
  }

  // Update batch with final settings
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "PENDING",
      fieldMappings: fieldMappings as unknown as Prisma.InputJsonValue,
      duplicateSettings: duplicateSettings as unknown as Prisma.InputJsonValue,
    },
  });

  // Create job progress
  const jobProgress = await createJobProgress({
    type: "import",
    userId,
    orgId,
    total: batch.totalRows || 100,
    metadata: {
      batchId,
      fileName: batch.fileName,
    },
  });

  // Queue the job
  const jobData: ImportJobData = {
    jobProgressId: jobProgress.id,
    batchId,
    orgId,
    userId,
  };

  await getJobQueue().add("import", jobData);

  return {
    jobProgressId: jobProgress.id,
    batchId,
  };
}

/**
 * Execute import processing (called by job processor)
 */
export async function executeImportProcessing(params: {
  batchId: string;
  orgId: string;
  userId: string;
  jobProgressId: string;
}): Promise<ImportExecutionResult> {
  const { batchId, orgId, userId, jobProgressId } = params;

  try {
    // Update status
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    await updateJobProgress(jobProgressId, { progress: 5 });

    // Get batch with settings
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    const fieldMappings = (batch.fieldMappings as unknown as ImportFieldMapping[]) || [];
    const duplicateSettings = (batch.duplicateSettings as unknown as DuplicateSettings) || DEFAULT_DUPLICATE_SETTINGS;

    // Re-parse the file to get all rows
    // In production, we'd read from S3
    // For now, we'll use the preview data as a simulation
    const allData = (batch.previewData as unknown as Record<string, unknown>[]) || [];

    await updateJobProgress(jobProgressId, { progress: 20 });

    // Check duplicates for all records
    const records = allData.map((row, idx) => ({
      rowNumber: idx + 1,
      sourceData: row,
    }));

    const duplicateResults = await checkForDuplicates(
      orgId,
      records,
      fieldMappings,
      duplicateSettings
    );

    await updateJobProgress(jobProgressId, { progress: 40 });

    // Process each record
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ rowNumber: number; message: string }> = [];

    for (let i = 0; i < duplicateResults.length; i++) {
      const result = duplicateResults[i];

      try {
        const processResult = await processImportRecord(
          batchId,
          orgId,
          userId,
          result,
          fieldMappings
        );

        switch (processResult.status) {
          case "CREATED":
            created++;
            break;
          case "UPDATED":
            updated++;
            break;
          case "SKIPPED":
            skipped++;
            break;
          case "FAILED":
            failed++;
            if (processResult.error) {
              errors.push({ rowNumber: result.rowNumber, message: processResult.error });
            }
            break;
        }
      } catch (error) {
        failed++;
        errors.push({
          rowNumber: result.rowNumber,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Update progress
      const progress = 40 + Math.floor((i / duplicateResults.length) * 50);
      await updateJobProgress(jobProgressId, { progress });
    }

    await updateJobProgress(jobProgressId, { progress: 95 });

    // Set rollback window (24 hours)
    const rollbackAvailableUntil = new Date();
    rollbackAvailableUntil.setHours(rollbackAvailableUntil.getHours() + 24);

    // Update batch
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "COMPLETED",
        processedRows: records.length,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        failedCount: failed,
        validationErrors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        rollbackAvailableUntil,
        completedAt: new Date(),
      },
    });

    await markJobCompleted(jobProgressId, {
      batchId,
      created,
      updated,
      skipped,
      failed,
    });

    return {
      batchId,
      status: "COMPLETED",
      totalRows: records.length,
      created,
      updated,
      skipped,
      failed,
      errors,
      rollbackAvailableUntil,
    };
  } catch (error) {
    console.error("Import processing failed:", error);

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        validationErrors: {
          error: error instanceof Error ? error.message : "Unknown error",
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await markJobFailed(
      jobProgressId,
      error instanceof Error ? error.message : "Import processing failed"
    );

    throw error;
  }
}

/**
 * Process a single import record
 */
async function processImportRecord(
  batchId: string,
  orgId: string,
  userId: string,
  duplicateResult: {
    rowNumber: number;
    sourceData: Record<string, unknown>;
    matches: Array<{ clientId: string; matchScore: number }>;
    suggestedAction: DuplicateAction;
  },
  fieldMappings: ImportFieldMapping[]
): Promise<{ status: ImportRecordStatus; error?: string }> {
  const { rowNumber, sourceData, matches, suggestedAction } = duplicateResult;

  // Map the data
  const mappedData: Record<string, unknown> = {};
  for (const mapping of fieldMappings) {
    const value = sourceData[mapping.sourceColumn];
    mappedData[mapping.targetField] = transformValue(value, mapping.transformer);
  }

  // Validate required fields
  const firstName = mappedData["client.firstName"];
  const lastName = mappedData["client.lastName"];
  const phone = mappedData["client.phone"];

  if (!firstName || !lastName || !phone) {
    await prisma.importRecord.create({
      data: {
        batchId,
        rowNumber,
        status: "FAILED",
        sourceData: sourceData as unknown as Prisma.InputJsonValue,
        mappedData: mappedData as unknown as Prisma.InputJsonValue,
        validationErrors: { error: "Missing required fields (firstName, lastName, phone)" } as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    return { status: "FAILED", error: "Missing required fields" };
  }

  try {
    let clientId: string | null = null;
    let status: ImportRecordStatus;

    switch (suggestedAction) {
      case "CREATE_NEW":
        // Create new client
        const newClient = await prisma.client.create({
          data: {
            orgId,
            firstName: String(firstName),
            lastName: String(lastName),
            phone: String(phone),
            email: mappedData["client.email"] ? String(mappedData["client.email"]) : null,
            internalId: mappedData["client.internalId"] ? String(mappedData["client.internalId"]) : null,
            address: buildAddressJson(mappedData),
            assignedTo: userId,
            createdBy: userId,
          },
        });
        clientId = newClient.id;
        status = "CREATED";
        break;

      case "UPDATE":
        // Update existing client
        if (matches.length > 0) {
          const matchId = matches[0].clientId;
          await prisma.client.update({
            where: { id: matchId },
            data: {
              firstName: String(firstName),
              lastName: String(lastName),
              phone: String(phone),
              email: mappedData["client.email"] ? String(mappedData["client.email"]) : undefined,
              internalId: mappedData["client.internalId"] ? String(mappedData["client.internalId"]) : undefined,
              address: buildAddressJson(mappedData),
            },
          });
          clientId = matchId;
          status = "UPDATED";
        } else {
          status = "SKIPPED";
        }
        break;

      case "SKIP":
      default:
        status = "SKIPPED";
        break;
    }

    // Create import record
    await prisma.importRecord.create({
      data: {
        batchId,
        rowNumber,
        status,
        action: suggestedAction,
        sourceData: sourceData as unknown as Prisma.InputJsonValue,
        mappedData: mappedData as unknown as Prisma.InputJsonValue,
        duplicateMatches: matches as unknown as Prisma.InputJsonValue,
        createdClientId: status === "CREATED" ? clientId : null,
        updatedClientId: status === "UPDATED" ? clientId : null,
        processedAt: new Date(),
      },
    });

    return { status };
  } catch (error) {
    await prisma.importRecord.create({
      data: {
        batchId,
        rowNumber,
        status: "FAILED",
        sourceData: sourceData as unknown as Prisma.InputJsonValue,
        mappedData: mappedData as unknown as Prisma.InputJsonValue,
        validationErrors: {
          error: error instanceof Error ? error.message : "Unknown error",
        } as unknown as Prisma.InputJsonValue,
        processedAt: new Date(),
      },
    });
    return { status: "FAILED", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Build address JSON from mapped data
 */
function buildAddressJson(mappedData: Record<string, unknown>): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const street = mappedData["client.address.street"];
  const city = mappedData["client.address.city"];
  const state = mappedData["client.address.state"];
  const zip = mappedData["client.address.zip"];

  if (!street && !city && !state && !zip) {
    return Prisma.JsonNull;
  }

  return {
    street: street ? String(street) : null,
    city: city ? String(city) : null,
    state: state ? String(state) : null,
    zip: zip ? String(zip) : null,
  };
}

// ============================================
// ROLLBACK
// ============================================

/**
 * Rollback an import batch
 */
export async function rollbackImport(
  batchId: string,
  orgId: string
): Promise<RollbackResult> {
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, orgId },
  });

  if (!batch) {
    return { success: false, batchId, rolledBackCount: 0, failedCount: 0, errors: ["Batch not found"] };
  }

  if (batch.status !== "COMPLETED") {
    return { success: false, batchId, rolledBackCount: 0, failedCount: 0, errors: ["Can only rollback completed imports"] };
  }

  if (!batch.rollbackAvailableUntil || new Date() > batch.rollbackAvailableUntil) {
    return { success: false, batchId, rolledBackCount: 0, failedCount: 0, errors: ["Rollback window has expired (24 hours)"] };
  }

  // Get all created clients
  const records = await prisma.importRecord.findMany({
    where: {
      batchId,
      status: "CREATED",
      createdClientId: { not: null },
    },
  });

  let rolledBackCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Soft delete the client
      await prisma.client.update({
        where: { id: record.createdClientId! },
        data: { deletedAt: new Date() },
      });

      // Update record status
      await prisma.importRecord.update({
        where: { id: record.id },
        data: { status: "ROLLED_BACK" },
      });

      rolledBackCount++;
    } catch (error) {
      failedCount++;
      errors.push(`Failed to rollback row ${record.rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Update batch status
  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "ROLLED_BACK",
      rollbackExecutedAt: new Date(),
    },
  });

  return {
    success: failedCount === 0,
    batchId,
    rolledBackCount,
    failedCount,
    errors,
  };
}

// ============================================
// BATCH RETRIEVAL
// ============================================

/**
 * Get import batch by ID
 */
export async function getImportBatch(batchId: string, orgId: string) {
  return prisma.importBatch.findFirst({
    where: { id: batchId, orgId },
    include: {
      template: true,
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { records: true },
      },
    },
  });
}

/**
 * List import batches
 */
export async function listImportBatches(
  orgId: string,
  options?: {
    status?: ImportStatus;
    limit?: number;
    offset?: number;
  }
) {
  const where: Prisma.ImportBatchWhereInput = {
    orgId,
    ...(options?.status && { status: options.status }),
  };

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        template: {
          select: { id: true, name: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.importBatch.count({ where }),
  ]);

  return { batches, total };
}
