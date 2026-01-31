/**
 * BullMQ Worker Setup
 *
 * Processes jobs from the queue with type-safe handlers.
 * Includes progress tracking and error handling.
 */

import { Worker, Job } from 'bullmq'
import { getRedisConnection } from './connection'
import {
  JobData,
  JobType,
  MassNoteBatchJobData,
  FormConversionJobData,
  ReportGenerationJobData,
} from './queue'

// Processor function type
type JobProcessor<T extends JobData> = (job: Job<T>) => Promise<void>

// Processor registry
const processors: Partial<Record<JobType, JobProcessor<JobData>>> = {}

/**
 * Register a job processor
 */
export function registerProcessor<T extends JobData>(
  type: JobType,
  processor: JobProcessor<T>
): void {
  processors[type] = processor as JobProcessor<JobData>
}

/**
 * Main job handler - routes jobs to registered processors
 */
async function processJob(job: Job<JobData>): Promise<void> {
  const type = job.name as JobType
  const processor = processors[type]

  if (!processor) {
    throw new Error(`No processor registered for job type: ${type}`)
  }

  await processor(job)
}

// Worker instance
let worker: Worker | null = null

/**
 * Start the job worker
 */
export function startWorker(options?: { concurrency?: number }): Worker {
  if (worker) {
    return worker
  }

  const concurrency = options?.concurrency ?? 5

  worker = new Worker('scrybe-jobs', processJob, {
    connection: getRedisConnection(),
    concurrency,
  })

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} (${job.name}) completed`)
  })

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} (${job?.name}) failed:`, error)
  })

  worker.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}`)
  })

  worker.on('error', (error) => {
    console.error('Worker error:', error)
  })

  console.log(`Worker started with concurrency: ${concurrency}`)

  return worker
}

/**
 * Stop the worker (for graceful shutdown)
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return worker !== null
}

// Export type guards for processors
export function isMassNoteBatchJob(data: JobData): data is MassNoteBatchJobData {
  return 'templateContent' in data && 'clientIds' in data
}

export function isFormConversionJob(data: JobData): data is FormConversionJobData {
  return 'conversionId' in data && 'sourcePath' in data
}

export function isReportGenerationJob(data: JobData): data is ReportGenerationJobData {
  return 'reportId' in data && 'templateId' in data && 'reportingPeriod' in data
}
