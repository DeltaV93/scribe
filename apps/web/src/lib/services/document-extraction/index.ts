/**
 * Document Extraction Service
 *
 * Main entry point for document-to-form-submission extraction.
 * Orchestrates OCR, field extraction, and confidence scoring.
 */

import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { isFeatureEnabled } from '@/lib/features/flags'
import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
  ExtractableFormField,
  ExtractedFieldValue,
  StoredExtraction,
  ApplyExtractionOptions,
  ApplyExtractionResult,
  DocumentSourceType,
} from './types'
import {
  extractTextFromPdf,
  extractTextFromImage,
  validateMagicBytes,
  getSourceType,
} from './ocr'
import { extractFieldsFromText } from './extraction'
import {
  adjustConfidence,
  calculateOverallConfidence,
  categorizeByConfidence,
  generateConfidenceSummary,
} from './confidence-scoring'

// Re-export types and utilities
export * from './types'
export * from './ocr'
export * from './extraction'
export * from './confidence-scoring'

// Supported MIME types
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]

// Maximum file size (25MB)
const MAX_FILE_SIZE = 25 * 1024 * 1024

/**
 * Start a document extraction for a form
 */
export async function startDocumentExtraction(
  input: DocumentExtractionInput
): Promise<{ extractionId: string; status: string }> {
  // Check feature flag
  const enabled = await isFeatureEnabled(input.orgId, 'photo-to-form')
  if (!enabled) {
    throw new Error('Photo/PDF to Form feature is not enabled for this organization')
  }

  // Validate file
  if (!SUPPORTED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`)
  }

  if (input.buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is 25MB`)
  }

  if (!validateMagicBytes(input.buffer, input.mimeType)) {
    throw new Error('File content does not match declared type')
  }

  // Verify form exists and user has access
  const form = await prisma.form.findFirst({
    where: {
      id: input.formId,
      orgId: input.orgId,
    },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!form) {
    throw new Error('Form not found')
  }

  // Create extraction record
  // Note: We're using FileUpload to store the file, then referencing it
  const sanitizedFilename = input.filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 100)
  const storagePath = `extractions/${input.orgId}/${Date.now()}_${sanitizedFilename}`

  // Create a FileUpload record to store the source document
  const fileUpload = await prisma.fileUpload.create({
    data: {
      orgId: input.orgId,
      originalName: input.filename,
      storagePath,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      scanStatus: 'PENDING',
      uploadedById: input.userId,
    },
  })

  // TODO: Upload buffer to S3 at storagePath

  // Create JobProgress record for tracking
  const jobProgress = await prisma.jobProgress.create({
    data: {
      type: 'document-extraction',
      userId: input.userId,
      orgId: input.orgId,
      status: 'PENDING',
      total: form.fields.length,
      metadata: {
        formId: input.formId,
        clientId: input.clientId,
        fileId: fileUpload.id,
        filename: input.filename,
      } as Prisma.InputJsonValue,
    },
  })

  return {
    extractionId: jobProgress.id,
    status: 'PENDING',
  }
}

/**
 * Process a document extraction (called by job processor or directly)
 */
export async function processDocumentExtraction(
  extractionId: string,
  buffer: Buffer
): Promise<DocumentExtractionResult> {
  const startTime = Date.now()
  const warnings: string[] = []

  // Get job progress record
  const jobProgress = await prisma.jobProgress.findUnique({
    where: { id: extractionId },
  })

  if (!jobProgress) {
    throw new Error('Extraction job not found')
  }

  const metadata = jobProgress.metadata as {
    formId: string
    clientId?: string
    fileId: string
    filename: string
  }

  // Update status to processing
  await prisma.jobProgress.update({
    where: { id: extractionId },
    data: { status: 'PROCESSING' },
  })

  try {
    // Get form with fields
    const form = await prisma.form.findUnique({
      where: { id: metadata.formId },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!form) {
      throw new Error('Form not found')
    }

    // Get file info
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: metadata.fileId },
    })

    if (!fileUpload) {
      throw new Error('Source file not found')
    }

    // Perform OCR
    let ocrResult
    if (fileUpload.mimeType === 'application/pdf') {
      ocrResult = await extractTextFromPdf(buffer)
    } else {
      ocrResult = await extractTextFromImage(buffer, fileUpload.mimeType)
    }

    // Store extracted text
    await prisma.fileUpload.update({
      where: { id: fileUpload.id },
      data: { extractedText: ocrResult.text.slice(0, 50000) },
    })

    // Prepare extractable fields
    const extractableFields: ExtractableFormField[] = form.fields
      .filter((f) => f.isAiExtractable)
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        type: f.type,
        helpText: f.helpText,
        isRequired: f.isRequired,
        options: f.options as { value: string; label: string }[] | null,
        section: f.section,
      }))

    // Extract field values
    const extractionResult = await extractFieldsFromText(
      ocrResult.text,
      extractableFields,
      ocrResult.isScanned
    )

    // Adjust confidence scores
    const adjustedFields = extractionResult.fields.map((extraction) => {
      const field = extractableFields.find((f) => f.id === extraction.fieldId)
      if (field) {
        return adjustConfidence(extraction, field)
      }
      return extraction
    })

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(
      adjustedFields,
      extractableFields
    )

    // Categorize by confidence
    const categories = categorizeByConfidence(adjustedFields)

    if (categories.lowConfidence.length > 0) {
      warnings.push(
        `${categories.lowConfidence.length} field(s) have low confidence and may need manual entry`
      )
    }

    if (categories.needsReview.length > 0) {
      warnings.push(
        `${categories.needsReview.length} field(s) need review before applying`
      )
    }

    const processingTimeMs = Date.now() - startTime

    // Update job progress with results
    await prisma.jobProgress.update({
      where: { id: extractionId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completed: adjustedFields.length,
        result: {
          documentText: ocrResult.text.slice(0, 10000),
          pageCount: ocrResult.pageCount,
          isScanned: ocrResult.isScanned,
          extractedFields: adjustedFields,
          overallConfidence,
          processingTimeMs,
          warnings,
          tokensUsed: extractionResult.tokensUsed,
          summary: generateConfidenceSummary(adjustedFields),
        } as unknown as Prisma.InputJsonValue,
      },
    })

    return {
      success: true,
      documentText: ocrResult.text,
      pageCount: ocrResult.pageCount,
      isScanned: ocrResult.isScanned,
      fields: adjustedFields,
      overallConfidence,
      processingTimeMs,
      tokensUsed: extractionResult.tokensUsed,
      warnings,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update job progress with error
    await prisma.jobProgress.update({
      where: { id: extractionId },
      data: {
        status: 'FAILED',
        error: errorMessage,
      },
    })

    return {
      success: false,
      documentText: '',
      pageCount: 0,
      isScanned: false,
      fields: [],
      overallConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      tokensUsed: { input: 0, output: 0 },
      warnings,
      error: errorMessage,
    }
  }
}

/**
 * Get extraction status and results
 */
export async function getExtractionStatus(extractionId: string): Promise<{
  status: string
  progress: number
  result?: {
    documentText?: string
    pageCount?: number
    isScanned?: boolean
    extractedFields?: ExtractedFieldValue[]
    overallConfidence?: number
    processingTimeMs?: number
    warnings?: string[]
    summary?: ReturnType<typeof generateConfidenceSummary>
  }
  error?: string
} | null> {
  const jobProgress = await prisma.jobProgress.findUnique({
    where: { id: extractionId },
  })

  if (!jobProgress) {
    return null
  }

  return {
    status: jobProgress.status,
    progress: jobProgress.progress,
    result: jobProgress.result as {
      documentText?: string
      pageCount?: number
      isScanned?: boolean
      extractedFields?: ExtractedFieldValue[]
      overallConfidence?: number
      processingTimeMs?: number
      warnings?: string[]
      summary?: ReturnType<typeof generateConfidenceSummary>
    } | undefined,
    error: jobProgress.error ?? undefined,
  }
}

/**
 * Apply extraction results to a form submission
 */
export async function applyExtractionToSubmission(
  extractionId: string,
  options: ApplyExtractionOptions = {}
): Promise<ApplyExtractionResult> {
  const minConfidence = options.minConfidence ?? 0
  const overwriteExisting = options.overwriteExisting ?? false

  // Get extraction results
  const jobProgress = await prisma.jobProgress.findUnique({
    where: { id: extractionId },
  })

  if (!jobProgress) {
    throw new Error('Extraction not found')
  }

  if (jobProgress.status !== 'COMPLETED') {
    throw new Error(`Cannot apply extraction with status: ${jobProgress.status}`)
  }

  const metadata = jobProgress.metadata as {
    formId: string
    clientId?: string
    submissionId?: string
  }

  const result = jobProgress.result as unknown as {
    extractedFields: ExtractedFieldValue[]
  }

  if (!result?.extractedFields) {
    throw new Error('No extracted fields found')
  }

  // Get form
  const form = await prisma.form.findUnique({
    where: { id: metadata.formId },
    include: {
      fields: true,
      versions: {
        where: { version: { gte: 1 } },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  })

  if (!form) {
    throw new Error('Form not found')
  }

  // Filter fields based on options
  let fieldsToApply = result.extractedFields.filter(
    (f) => f.confidence >= minConfidence && f.value !== null
  )

  if (options.includeFieldIds && options.includeFieldIds.length > 0) {
    fieldsToApply = fieldsToApply.filter((f) =>
      options.includeFieldIds!.includes(f.fieldId)
    )
  }

  if (options.excludeFieldIds && options.excludeFieldIds.length > 0) {
    fieldsToApply = fieldsToApply.filter(
      (f) => !options.excludeFieldIds!.includes(f.fieldId)
    )
  }

  // Build submission data
  const submissionData: Record<string, unknown> = {}
  const details: ApplyExtractionResult['details'] = []

  for (const extraction of result.extractedFields) {
    const shouldApply =
      fieldsToApply.find((f) => f.fieldId === extraction.fieldId) !== undefined

    if (shouldApply) {
      submissionData[extraction.fieldSlug] = extraction.value
      details.push({
        fieldId: extraction.fieldId,
        fieldSlug: extraction.fieldSlug,
        applied: true,
      })
    } else {
      details.push({
        fieldId: extraction.fieldId,
        fieldSlug: extraction.fieldSlug,
        applied: false,
        reason:
          extraction.confidence < minConfidence
            ? 'Below confidence threshold'
            : extraction.value === null
              ? 'No value extracted'
              : 'Excluded by options',
      })
    }
  }

  // Get or create form version
  const formVersion =
    form.versions[0] ||
    (await prisma.formVersion.create({
      data: {
        formId: form.id,
        version: 1,
        snapshot: {},
        aiExtractionPrompt: '',
        publishedById: jobProgress.userId,
      },
    }))

  // Create or update submission
  let submissionId = metadata.submissionId

  if (submissionId && overwriteExisting) {
    // Update existing submission
    const existingSubmission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
    })

    if (existingSubmission) {
      const existingData = existingSubmission.data as Record<string, unknown>
      const mergedData = { ...existingData, ...submissionData }

      await prisma.formSubmission.update({
        where: { id: submissionId },
        data: {
          data: mergedData as Prisma.InputJsonValue,
          aiExtractedData: submissionData as Prisma.InputJsonValue,
          aiConfidence: {
            overall: result.extractedFields.reduce((s, f) => s + f.confidence, 0) /
              result.extractedFields.length,
            fields: Object.fromEntries(
              result.extractedFields.map((f) => [f.fieldSlug, f.confidence])
            ),
          } as Prisma.InputJsonValue,
          flaggedFields: result.extractedFields
            .filter((f) => f.needsReview)
            .map((f) => f.fieldSlug),
        },
      })
    }
  } else {
    // Create new submission
    const submission = await prisma.formSubmission.create({
      data: {
        orgId: jobProgress.orgId,
        formId: form.id,
        formVersionId: formVersion.id,
        clientId: metadata.clientId,
        data: submissionData as Prisma.InputJsonValue,
        aiExtractedData: submissionData as Prisma.InputJsonValue,
        aiConfidence: {
          overall: result.extractedFields.reduce((s, f) => s + f.confidence, 0) /
            result.extractedFields.length,
          fields: Object.fromEntries(
            result.extractedFields.map((f) => [f.fieldSlug, f.confidence])
          ),
        } as Prisma.InputJsonValue,
        flaggedFields: result.extractedFields
          .filter((f) => f.needsReview)
          .map((f) => f.fieldSlug),
        isDraft: true,
        submittedById: jobProgress.userId,
      },
    })

    submissionId = submission.id

    // Update job progress with submission ID
    await prisma.jobProgress.update({
      where: { id: extractionId },
      data: {
        metadata: {
          ...metadata,
          submissionId,
        } as Prisma.InputJsonValue,
      },
    })
  }

  return {
    submissionId: submissionId!,
    appliedFields: details.filter((d) => d.applied).length,
    skippedFields: details.filter((d) => !d.applied).length,
    details,
  }
}

/**
 * Update a single extracted field value (for manual corrections)
 */
export async function updateExtractedField(
  extractionId: string,
  fieldId: string,
  value: string | number | boolean | string[] | null,
  confidence?: number
): Promise<ExtractedFieldValue | null> {
  const jobProgress = await prisma.jobProgress.findUnique({
    where: { id: extractionId },
  })

  if (!jobProgress || !jobProgress.result) {
    return null
  }

  const result = jobProgress.result as {
    extractedFields: ExtractedFieldValue[]
    [key: string]: unknown
  }

  const fieldIndex = result.extractedFields.findIndex((f) => f.fieldId === fieldId)
  if (fieldIndex === -1) {
    return null
  }

  // Update the field
  const updatedField: ExtractedFieldValue = {
    ...result.extractedFields[fieldIndex],
    value,
    confidence: confidence ?? 1.0, // Manual entry = high confidence
    needsReview: false,
    validationErrors: [],
  }

  result.extractedFields[fieldIndex] = updatedField

  // Save back to database
  await prisma.jobProgress.update({
    where: { id: extractionId },
    data: {
      result: result as Prisma.InputJsonValue,
    },
  })

  return updatedField
}

/**
 * List extractions for a form or user
 */
export async function listExtractions(options: {
  orgId: string
  formId?: string
  userId?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const where: Prisma.JobProgressWhereInput = {
    orgId: options.orgId,
    type: 'document-extraction',
  }

  if (options.userId) {
    where.userId = options.userId
  }

  if (options.status) {
    where.status = options.status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  }

  // Filter by formId in metadata
  if (options.formId) {
    where.metadata = {
      path: ['formId'],
      equals: options.formId,
    }
  }

  const [items, total] = await Promise.all([
    prisma.jobProgress.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 20,
      skip: options.offset ?? 0,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.jobProgress.count({ where }),
  ])

  return { items, total }
}

/**
 * Delete an extraction
 */
export async function deleteExtraction(extractionId: string): Promise<void> {
  const jobProgress = await prisma.jobProgress.findUnique({
    where: { id: extractionId },
  })

  if (!jobProgress) {
    throw new Error('Extraction not found')
  }

  const metadata = jobProgress.metadata as { fileId?: string }

  // Delete associated file upload
  if (metadata.fileId) {
    await prisma.fileUpload.delete({
      where: { id: metadata.fileId },
    }).catch(() => {
      // Ignore if file doesn't exist
    })
  }

  // Delete job progress
  await prisma.jobProgress.delete({
    where: { id: extractionId },
  })
}
