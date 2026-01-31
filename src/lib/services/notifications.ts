/**
 * Notifications Service
 *
 * CRUD operations for user notifications.
 * Used to notify users of job completions, errors, and other events.
 */

import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

// Notification types
export type NotificationType =
  | 'job-completed'
  | 'job-failed'
  | 'mass-notes-created'
  | 'form-conversion-ready'
  | 'report-generated'
  | 'system'
  | 'warning'
  | 'info'

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown>
}

/**
 * Create a notification for a user
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  })
}

/**
 * Get a notification by ID
 */
export async function getNotification(id: string) {
  return prisma.notification.findUnique({
    where: { id },
  })
}

/**
 * List notifications for a user
 */
export async function listNotifications(options: {
  userId: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {
    userId: options.userId,
  }

  if (options.unreadOnly) {
    where.read = false
  }

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 20,
      skip: options.offset ?? 0,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId: options.userId,
        read: false,
      },
    }),
  ])

  return { items, total, unreadCount }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: { read: true },
  })
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string) {
  return prisma.notification.delete({
    where: { id },
  })
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: { userId },
  })
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  })
}

/**
 * Cleanup old read notifications
 */
export async function cleanupOldNotifications(options: {
  maxAgeDays?: number
  readOnly?: boolean
}) {
  const maxAgeDays = options.maxAgeDays ?? 30
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

  const where: Record<string, unknown> = {
    createdAt: { lt: cutoffDate },
  }

  if (options.readOnly) {
    where.read = true
  }

  return prisma.notification.deleteMany({ where })
}

// Convenience functions for creating specific notification types

/**
 * Notify user that a job completed successfully
 */
export async function notifyJobCompleted(
  userId: string,
  jobType: string,
  result?: { count?: number; message?: string }
) {
  const messages: Record<string, string> = {
    'mass-note-batch': `Successfully created notes for ${result?.count ?? 0} clients`,
    'form-conversion': 'Your form conversion is ready for review',
    'report-generation': 'Your report has been generated and is ready to download',
  }

  return createNotification({
    userId,
    type: 'job-completed',
    title: 'Job Completed',
    message: messages[jobType] ?? result?.message ?? 'Your job has completed',
    metadata: { jobType, ...result },
  })
}

/**
 * Notify user that a job failed
 */
export async function notifyJobFailed(
  userId: string,
  jobType: string,
  error: string
) {
  return createNotification({
    userId,
    type: 'job-failed',
    title: 'Job Failed',
    message: `An error occurred: ${error}`,
    metadata: { jobType, error },
  })
}
