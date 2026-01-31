/**
 * Form Conversion Service
 *
 * Main entry point for form conversion functionality.
 * Coordinates security, OCR, field detection, and duplicate detection.
 */

import { ConversionSourceType, ConversionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { isFeatureEnabled } from '@/lib/features/flags'
import { validateFile, sanitizeFilename, scanPdfForThreats, validateMagicBytes } from './security'
import { extractFromPdf, extractFromImage, type OcrResult } from './ocr'
import { detectFields, validateDetectedFields, type DetectedField, type FieldDetectionResult } from './field-detection'
import { checkForDuplicates, generateFieldFingerprint, type DuplicateCheckResult } from './duplicate-detection'

export * from './security'
export * from './ocr'
export * from './field-detection'
export * from './duplicate-detection'
export * from './pdf-export'

export interface ConversionInput {
  orgId: string
  userId: string
  filename: string
  mimeType: string
  buffer: Buffer
}

export interface ConversionResult {
  conversionId: string
  status: ConversionStatus
  ocrResult?: OcrResult
  fieldResult?: FieldDetectionResult
  duplicateCheck?: DuplicateCheckResult
  warnings: string[]
  error?: string
}

/**
 * Start a form conversion from an uploaded file
 */
export async function startConversion(input: ConversionInput): Promise<ConversionResult> {
  const warnings: string[] = []

  // Check if feature is enabled
  const enabled = await isFeatureEnabled(input.orgId, 'photo-to-form')
  if (!enabled) {
    throw new Error('Photo/PDF to Form feature is not enabled for this organization')
  }

  // Validate the file
  const validation = validateFile(input.filename, input.mimeType, input.buffer.length)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }
  warnings.push(...validation.warnings)

  // Validate magic bytes
  if (!validateMagicBytes(input.buffer, input.mimeType)) {
    throw new Error('File content does not match declared type')
  }

  // Determine source type
  let sourceType = validation.sourceType as ConversionSourceType

  // For PDFs, scan for threats
  if (input.mimeType === 'application/pdf') {
    const scanResult = await scanPdfForThreats(input.buffer)
    if (!scanResult.isSafe) {
      throw new Error(`PDF security check failed: ${scanResult.threats.join(', ')}`)
    }
  }

  // Create sanitized filename
  const sanitizedName = sanitizeFilename(input.filename)

  // Create conversion record
  const conversion = await prisma.formConversion.create({
    data: {
      orgId: input.orgId,
      createdById: input.userId,
      sourceType,
      sourcePath: `conversions/${input.orgId}/${sanitizedName}`,
      status: 'PENDING',
      warnings,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  })

  return {
    conversionId: conversion.id,
    status: conversion.status,
    warnings,
  }
}

/**
 * Process a conversion (OCR + field detection)
 */
export async function processConversion(conversionId: string): Promise<ConversionResult> {
  const warnings: string[] = []

  // Get conversion record
  const conversion = await prisma.formConversion.findUnique({
    where: { id: conversionId },
  })

  if (!conversion) {
    throw new Error('Conversion not found')
  }

  if (conversion.status !== 'PENDING') {
    throw new Error(`Conversion is already ${conversion.status.toLowerCase()}`)
  }

  // Update status to processing
  await prisma.formConversion.update({
    where: { id: conversionId },
    data: { status: 'PROCESSING' },
  })

  try {
    // In a real implementation, we would fetch the file from S3
    // For now, we'll assume the buffer is passed or stored temporarily
    // This is a placeholder for the actual file retrieval
    const buffer = Buffer.from('') // TODO: Fetch from S3 using conversion.sourcePath

    // Perform OCR
    let ocrResult: OcrResult

    if (conversion.sourceType === 'PHOTO') {
      ocrResult = await extractFromImage(buffer, 'image/jpeg')
    } else {
      ocrResult = await extractFromPdf(buffer)

      // Update source type if it's a scanned PDF
      if (ocrResult.isScanned && conversion.sourceType === 'PDF_CLEAN') {
        await prisma.formConversion.update({
          where: { id: conversionId },
          data: { sourceType: 'PDF_SCANNED' },
        })
      }
    }

    // Detect fields
    const fieldResult = await detectFields(ocrResult)
    warnings.push(...fieldResult.warnings)

    // Validate detected fields
    const fieldValidation = validateDetectedFields(fieldResult.fields)
    warnings.push(...fieldValidation.warnings)

    if (!fieldValidation.isValid) {
      throw new Error(`Field validation failed: ${fieldValidation.errors.join(', ')}`)
    }

    // Check for duplicates
    const duplicateCheck = await checkForDuplicates(conversion.orgId, fieldResult.fields)

    // Determine final status
    const status: ConversionStatus =
      fieldResult.overallConfidence < 0.7 || duplicateCheck.hasDuplicate
        ? 'REVIEW_REQUIRED'
        : 'REVIEW_REQUIRED' // Always require review for safety

    // Update conversion record
    await prisma.formConversion.update({
      where: { id: conversionId },
      data: {
        status,
        detectedFields: fieldResult.fields as unknown as Prisma.InputJsonValue,
        confidence: fieldResult.overallConfidence,
        warnings,
        requiresOriginalExport: conversion.sourceType !== 'PHOTO',
      },
    })

    return {
      conversionId,
      status,
      ocrResult,
      fieldResult,
      duplicateCheck,
      warnings,
    }
  } catch (error) {
    // Update status to failed
    await prisma.formConversion.update({
      where: { id: conversionId },
      data: {
        status: 'FAILED',
        warnings: [
          ...warnings,
          error instanceof Error ? error.message : 'Unknown error',
        ],
      },
    })

    return {
      conversionId,
      status: 'FAILED',
      warnings,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a form from a completed conversion
 */
export async function createFormFromConversion(
  conversionId: string,
  userId: string,
  options: {
    name?: string
    description?: string
    type?: string
    selectedFields?: string[] // Field slugs to include
  } = {}
): Promise<string> {
  // Get conversion with detected fields
  const conversion = await prisma.formConversion.findUnique({
    where: { id: conversionId },
  })

  if (!conversion) {
    throw new Error('Conversion not found')
  }

  if (conversion.status !== 'REVIEW_REQUIRED' && conversion.status !== 'COMPLETED') {
    throw new Error(`Cannot create form from conversion with status: ${conversion.status}`)
  }

  const detectedFields = (conversion.detectedFields || []) as unknown as DetectedField[]

  // Filter fields if specified
  const fieldsToCreate = options.selectedFields
    ? detectedFields.filter((f) => options.selectedFields!.includes(f.slug))
    : detectedFields

  if (fieldsToCreate.length === 0) {
    throw new Error('No fields selected for form creation')
  }

  // Generate field fingerprint
  const fingerprint = generateFieldFingerprint(fieldsToCreate)

  // Create the form with fields
  const form = await prisma.form.create({
    data: {
      orgId: conversion.orgId,
      createdById: userId,
      name: options.name || 'Converted Form',
      description: options.description,
      type: (options.type as 'INTAKE' | 'FOLLOWUP' | 'REFERRAL' | 'ASSESSMENT' | 'CUSTOM') || 'CUSTOM',
      status: 'DRAFT',
      fieldFingerprint: fingerprint,
      fields: {
        create: fieldsToCreate.map((field, index) => ({
          slug: field.slug,
          name: field.name,
          type: field.type,
          purpose: field.purpose,
          purposeNote: field.purposeNote,
          helpText: field.helpText,
          isRequired: field.isRequired,
          isSensitive: field.isSensitive,
          options: field.options as Prisma.InputJsonValue,
          section: field.section,
          order: index,
        })),
      },
    },
  })

  // Update conversion with result form
  await prisma.formConversion.update({
    where: { id: conversionId },
    data: {
      status: 'COMPLETED',
      resultFormId: form.id,
    },
  })

  return form.id
}

/**
 * Get conversion status and details
 */
export async function getConversionStatus(conversionId: string) {
  const conversion = await prisma.formConversion.findUnique({
    where: { id: conversionId },
    include: {
      resultForm: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!conversion) {
    return null
  }

  return {
    id: conversion.id,
    status: conversion.status,
    sourceType: conversion.sourceType,
    confidence: conversion.confidence,
    warnings: conversion.warnings,
    detectedFields: conversion.detectedFields as unknown as DetectedField[],
    fieldPositions: conversion.fieldPositions,
    requiresOriginalExport: conversion.requiresOriginalExport,
    resultForm: conversion.resultForm,
    createdBy: conversion.createdBy,
    createdAt: conversion.createdAt,
    expiresAt: conversion.expiresAt,
  }
}

/**
 * Delete a conversion and its associated files
 */
export async function deleteConversion(conversionId: string): Promise<void> {
  const conversion = await prisma.formConversion.findUnique({
    where: { id: conversionId },
  })

  if (!conversion) {
    throw new Error('Conversion not found')
  }

  // TODO: Delete source file from S3

  await prisma.formConversion.delete({
    where: { id: conversionId },
  })
}

/**
 * List conversions for an organization
 */
export async function listConversions(
  orgId: string,
  options: {
    status?: ConversionStatus
    limit?: number
    offset?: number
  } = {}
) {
  const where: Prisma.FormConversionWhereInput = { orgId }

  if (options.status) {
    where.status = options.status
  }

  const [items, total] = await Promise.all([
    prisma.formConversion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 20,
      skip: options.offset ?? 0,
      include: {
        resultForm: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.formConversion.count({ where }),
  ])

  return { items, total }
}
