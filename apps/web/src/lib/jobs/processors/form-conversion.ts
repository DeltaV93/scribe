/**
 * Form Conversion Job Processor
 *
 * Processes form conversion jobs asynchronously.
 * Handles OCR, field detection, and duplicate checking.
 */

import { Job } from 'bullmq'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  FormConversionJobData,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
} from '@/lib/jobs'
import { registerProcessor } from '../worker'
import {
  extractFromPdf,
  extractFromImage,
  detectFields,
  validateDetectedFields,
  checkForDuplicates,
} from '@/lib/services/form-conversion'
import { notifyJobCompleted, notifyJobFailed } from '@/lib/services/notifications'

// Placeholder for S3 operations
async function fetchFileFromS3(path: string): Promise<Buffer> {
  // In production, this would use @aws-sdk/client-s3
  // For now, return empty buffer (actual implementation depends on S3 setup)
  console.log(`[FormConversion] Would fetch file from S3: ${path}`)
  return Buffer.from('')
}

/**
 * Process a form conversion job
 */
async function processFormConversion(job: Job<FormConversionJobData>): Promise<void> {
  const {
    jobProgressId,
    conversionId,
    sourcePath,
    sourceType,
    orgId,
    userId,
  } = job.data

  console.log(`[FormConversion] Starting job ${jobProgressId} for conversion ${conversionId}`)

  try {
    // Mark as processing
    await markJobProcessing(jobProgressId)
    await job.updateProgress(10)

    // Update conversion status
    await prisma.formConversion.update({
      where: { id: conversionId },
      data: { status: 'PROCESSING' },
    })

    // Fetch file from S3
    const buffer = await fetchFileFromS3(sourcePath)
    await job.updateProgress(20)

    if (buffer.length === 0) {
      // In development/testing, we might not have actual files
      // Mark as needing manual review
      await prisma.formConversion.update({
        where: { id: conversionId },
        data: {
          status: 'REVIEW_REQUIRED',
          warnings: ['Source file not available - manual field entry required'],
        },
      })

      await markJobCompleted(jobProgressId, {
        status: 'REVIEW_REQUIRED',
        message: 'Manual field entry required',
      })

      await notifyJobCompleted(userId, 'form-conversion', {
        message: 'Your document is ready for manual field configuration',
      })

      return
    }

    // Perform OCR based on source type
    console.log(`[FormConversion] Running OCR for ${sourceType}`)
    let ocrResult

    if (sourceType === 'PHOTO') {
      ocrResult = await extractFromImage(buffer, 'image/jpeg')
    } else {
      ocrResult = await extractFromPdf(buffer)
    }
    await job.updateProgress(50)

    // Update source type if scanned PDF detected
    if (ocrResult.isScanned && sourceType === 'PDF_CLEAN') {
      await prisma.formConversion.update({
        where: { id: conversionId },
        data: { sourceType: 'PDF_SCANNED' },
      })
    }

    // Detect fields
    console.log(`[FormConversion] Detecting fields`)
    const fieldResult = await detectFields(ocrResult)
    await job.updateProgress(70)

    // Validate fields
    const fieldValidation = validateDetectedFields(fieldResult.fields)
    const warnings = [
      ...fieldResult.warnings,
      ...fieldValidation.warnings,
    ]

    if (!fieldValidation.isValid) {
      warnings.push(...fieldValidation.errors)
    }

    // Check for duplicates
    console.log(`[FormConversion] Checking for duplicates`)
    const duplicateCheck = await checkForDuplicates(orgId, fieldResult.fields)
    await job.updateProgress(85)

    if (duplicateCheck.hasDuplicate) {
      warnings.push(
        `Similar form found: "${duplicateCheck.duplicateFormName}" (${Math.round(duplicateCheck.similarity * 100)}% similarity)`
      )
    }

    // Determine final status
    const status =
      fieldResult.overallConfidence < 0.5 || !fieldValidation.isValid
        ? 'FAILED'
        : 'REVIEW_REQUIRED'

    // Update conversion record
    await prisma.formConversion.update({
      where: { id: conversionId },
      data: {
        status,
        detectedFields: fieldResult.fields as unknown as Prisma.InputJsonValue,
        confidence: fieldResult.overallConfidence,
        warnings,
        requiresOriginalExport: sourceType !== 'PHOTO',
      },
    })
    await job.updateProgress(95)

    // Mark job as completed
    await markJobCompleted(jobProgressId, {
      status,
      fieldsDetected: fieldResult.fields.length,
      confidence: fieldResult.overallConfidence,
      hasDuplicate: duplicateCheck.hasDuplicate,
      duplicateFormId: duplicateCheck.duplicateFormId,
    })

    // Notify user
    if (status === 'FAILED') {
      await notifyJobFailed(
        userId,
        'form-conversion',
        'Field detection failed - please try with a clearer image'
      )
    } else {
      await notifyJobCompleted(userId, 'form-conversion', {
        message: `Detected ${fieldResult.fields.length} fields. Ready for review.`,
      })
    }

    console.log(
      `[FormConversion] Job ${jobProgressId} completed: ${fieldResult.fields.length} fields, confidence ${fieldResult.overallConfidence}`
    )
  } catch (error) {
    console.error(`[FormConversion] Job ${jobProgressId} failed:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update conversion status
    await prisma.formConversion.update({
      where: { id: conversionId },
      data: {
        status: 'FAILED',
        warnings: [errorMessage],
      },
    })

    await markJobFailed(jobProgressId, errorMessage)
    await notifyJobFailed(userId, 'form-conversion', errorMessage)

    throw error
  }
}

// Register the processor
registerProcessor('form-conversion', processFormConversion)

export { processFormConversion }
