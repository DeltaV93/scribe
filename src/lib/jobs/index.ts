/**
 * Job Infrastructure
 *
 * Exports all job-related functionality for easy imports.
 */

// Connection
export {
  getRedisConnection,
  closeRedisConnection,
  isRedisHealthy,
  isRedisConfigured,
} from './connection'

// Queue
export {
  getJobQueue,
  addJob,
  getJob,
  removeJob,
  getQueueMetrics,
  closeQueues,
  type JobType,
  type JobData,
  type MassNoteBatchJobData,
  type FormConversionJobData,
  type ReportGenerationJobData,
} from './queue'

// Worker
export {
  registerProcessor,
  startWorker,
  stopWorker,
  isWorkerRunning,
  isMassNoteBatchJob,
  isFormConversionJob,
  isReportGenerationJob,
} from './worker'

// Progress
export {
  createJobProgress,
  getJobProgress,
  updateJobProgress,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  incrementJobCompleted,
  incrementJobFailed,
  listJobProgress,
  deleteJobProgress,
  cleanupOldJobs,
  type CreateJobProgressInput,
  type UpdateJobProgressInput,
} from './progress'
