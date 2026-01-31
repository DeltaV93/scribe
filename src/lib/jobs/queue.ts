/**
 * BullMQ Queue Configuration
 *
 * Defines job queues and job types for async processing.
 * Jobs include: mass note batches, form conversions, and report generation.
 */

import { Queue, QueueOptions } from 'bullmq'
import { getRedisConnection } from './connection'

// Job type definitions
export type JobType = 'mass-note-batch' | 'form-conversion' | 'report-generation'

// Job data types
export interface MassNoteBatchJobData {
  jobProgressId: string
  sessionId: string
  templateId?: string
  templateContent: string
  clientIds: string[]
  authorId: string
  orgId: string
  noteType: 'INTERNAL' | 'SHAREABLE'
  tags: string[]
  variables: Record<string, string>
}

export interface FormConversionJobData {
  jobProgressId: string
  conversionId: string
  sourcePath: string
  sourceType: 'PHOTO' | 'PDF_CLEAN' | 'PDF_SCANNED'
  orgId: string
  userId: string
}

export interface ReportGenerationJobData {
  jobProgressId: string
  reportId: string
  templateId: string
  orgId: string
  userId: string
  reportingPeriod: {
    start: string | Date
    end: string | Date
  }
  programIds?: string[]
}

export type JobData = MassNoteBatchJobData | FormConversionJobData | ReportGenerationJobData

// Queue instances (lazy loaded)
let jobQueue: Queue | null = null

/**
 * Get queue options (created lazily to avoid initializing Redis at import time)
 */
function getQueueOptions(): QueueOptions {
  return {
    connection: getRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: {
        age: 24 * 60 * 60, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // 7 days
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  }
}

/**
 * Get the main job queue
 */
export function getJobQueue(): Queue {
  if (!jobQueue) {
    jobQueue = new Queue('scrybe-jobs', getQueueOptions())
  }
  return jobQueue
}

/**
 * Add a job to the queue
 */
export async function addJob<T extends JobData>(
  type: JobType,
  data: T,
  options?: {
    priority?: number
    delay?: number
    jobId?: string
  }
): Promise<string> {
  const queue = getJobQueue()

  const job = await queue.add(type, data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  })

  return job.id ?? ''
}

/**
 * Get a job by ID
 */
export async function getJob(jobId: string) {
  const queue = getJobQueue()
  return queue.getJob(jobId)
}

/**
 * Remove a job by ID
 */
export async function removeJob(jobId: string): Promise<boolean> {
  const queue = getJobQueue()
  const job = await queue.getJob(jobId)

  if (job) {
    await job.remove()
    return true
  }

  return false
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const queue = getJobQueue()

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  }
}

/**
 * Close all queues (for graceful shutdown)
 */
export async function closeQueues(): Promise<void> {
  if (jobQueue) {
    await jobQueue.close()
    jobQueue = null
  }
}
