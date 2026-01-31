/**
 * Job Progress Service
 *
 * CRUD operations for tracking job progress in the database.
 * Used to display job status to users and persist progress across restarts.
 */

import { JobStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export interface CreateJobProgressInput {
  type: string
  userId: string
  orgId: string
  total: number
  metadata?: Record<string, unknown>
}

export interface UpdateJobProgressInput {
  status?: JobStatus
  progress?: number
  completed?: number
  failed?: number
  result?: Record<string, unknown>
  error?: string
}

/**
 * Create a new job progress record
 */
export async function createJobProgress(input: CreateJobProgressInput) {
  return prisma.jobProgress.create({
    data: {
      type: input.type,
      userId: input.userId,
      orgId: input.orgId,
      total: input.total,
      status: 'PENDING',
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
}

/**
 * Get a job progress record by ID
 */
export async function getJobProgress(id: string) {
  return prisma.jobProgress.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Update a job progress record
 */
export async function updateJobProgress(id: string, input: UpdateJobProgressInput) {
  const data: Record<string, unknown> = {}

  if (input.status !== undefined) data.status = input.status
  if (input.progress !== undefined) data.progress = input.progress
  if (input.completed !== undefined) data.completed = input.completed
  if (input.failed !== undefined) data.failed = input.failed
  if (input.result !== undefined) data.result = input.result
  if (input.error !== undefined) data.error = input.error

  return prisma.jobProgress.update({
    where: { id },
    data,
  })
}

/**
 * Mark a job as processing
 */
export async function markJobProcessing(id: string) {
  return updateJobProgress(id, { status: 'PROCESSING' })
}

/**
 * Mark a job as completed
 */
export async function markJobCompleted(
  id: string,
  result?: Record<string, unknown>
) {
  return updateJobProgress(id, {
    status: 'COMPLETED',
    progress: 100,
    result,
  })
}

/**
 * Mark a job as failed
 */
export async function markJobFailed(id: string, error: string) {
  return updateJobProgress(id, {
    status: 'FAILED',
    error,
  })
}

/**
 * Increment the completed count for a job
 */
export async function incrementJobCompleted(id: string, count: number = 1) {
  const job = await prisma.jobProgress.findUnique({ where: { id } })
  if (!job) return null

  const newCompleted = job.completed + count
  const progress = Math.round((newCompleted / job.total) * 100)

  return prisma.jobProgress.update({
    where: { id },
    data: {
      completed: newCompleted,
      progress,
    },
  })
}

/**
 * Increment the failed count for a job
 */
export async function incrementJobFailed(id: string, count: number = 1) {
  const job = await prisma.jobProgress.findUnique({ where: { id } })
  if (!job) return null

  return prisma.jobProgress.update({
    where: { id },
    data: {
      failed: job.failed + count,
    },
  })
}

/**
 * List job progress records for a user
 */
export async function listJobProgress(options: {
  userId?: string
  orgId?: string
  type?: string
  status?: JobStatus
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}

  if (options.userId) where.userId = options.userId
  if (options.orgId) where.orgId = options.orgId
  if (options.type) where.type = options.type
  if (options.status) where.status = options.status

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
 * Delete a job progress record
 */
export async function deleteJobProgress(id: string) {
  return prisma.jobProgress.delete({ where: { id } })
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(options: {
  maxAgeDays?: number
  status?: JobStatus[]
}) {
  const maxAgeDays = options.maxAgeDays ?? 30
  const statuses = options.status ?? ['COMPLETED', 'FAILED']
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

  return prisma.jobProgress.deleteMany({
    where: {
      status: { in: statuses },
      createdAt: { lt: cutoffDate },
    },
  })
}
