/**
 * Document Extraction Job Processor
 *
 * Processes document extraction jobs asynchronously.
 * Extracts field values from photos/PDFs to populate form submissions.
 */

import { Job } from 'bullmq'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  DocumentExtractionJobData,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
} from '@/lib/jobs'
import { registerProcessor } from '../worker'
import { processDocumentExtraction } from '@/lib/services/document-extraction'
import { notifyJobCompleted, notifyJobFailed } from '@/lib/services/notifications'

// Placeholder for S3 operations
async function fetchFileFromS3(path: string): Promise<Buffer> {
  // In production, this would use @aws-sdk/client-s3
  // For now, return empty buffer (actual implementation depends on S3 setup)
  console.log(`[DocumentExtraction] Would fetch file from S3: ${path}`)
  return Buffer.from('')
}

/**
 * Process a document extraction job
 */
async function processDocumentExtractionJob(job: Job<DocumentExtractionJobData>): Promise<void> {
  const {
    jobProgressId,
    extractionId,
    formId,
    clientId,
    sourcePath,
    sourceType,
    orgId,
    userId,
  } = job.data

  console.log(`[DocumentExtraction] Starting job ${jobProgressId} for extraction ${extractionId}`)

  try {
    // Mark as processing
    await markJobProcessing(jobProgressId)
    await job.updateProgress(10)

    // Fetch file from S3
    const buffer = await fetchFileFromS3(sourcePath)
    await job.updateProgress(20)

    if (buffer.length === 0) {
      // In development/testing, we might not have actual files
      // Update job to failed state
      await markJobFailed(jobProgressId, 'Source file not available')
      await notifyJobFailed(userId, 'document-extraction', 'Source file not available')
      return
    }

    // Process the extraction
    await job.updateProgress(30)
    const result = await processDocumentExtraction(extractionId, buffer)
    await job.updateProgress(90)

    if (!result.success) {
      await notifyJobFailed(
        userId,
        'document-extraction',
        result.error || 'Extraction failed'
      )
      return
    }

    // Notify user
    await notifyJobCompleted(userId, 'document-extraction', {
      message: `Extracted ${result.fields.length} fields with ${Math.round(result.overallConfidence * 100)}% confidence`,
      count: result.fields.length,
    })

    console.log(
      `[DocumentExtraction] Job ${jobProgressId} completed: ${result.fields.length} fields, confidence ${result.overallConfidence}`
    )
  } catch (error) {
    console.error(`[DocumentExtraction] Job ${jobProgressId} failed:`, error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await markJobFailed(jobProgressId, errorMessage)
    await notifyJobFailed(userId, 'document-extraction', errorMessage)

    throw error
  }
}

// Register the processor
registerProcessor('document-extraction', processDocumentExtractionJob)

export { processDocumentExtractionJob }
