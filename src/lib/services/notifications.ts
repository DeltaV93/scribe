/**
 * Notifications Service
 *
 * CRUD operations for user notifications.
 * Used to notify users of job completions, mentions, approvals, and other events.
 */

import { prisma } from '@/lib/db'
import type { Prisma, NotificationType as PrismaNotificationType } from '@prisma/client'

// Re-export the Prisma NotificationType for convenience
export type NotificationType = PrismaNotificationType | string

export interface CreateNotificationInput {
  orgId: string
  userId: string
  type: NotificationType
  title: string
  /** The notification message body. Also accepts `message` for backward compatibility. */
  body?: string
  /** @deprecated Use `body` instead */
  message?: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export interface NotificationResult {
  id: string
  orgId: string
  userId: string
  type: string
  title: string
  body: string | null
  actionUrl: string | null
  metadata: Record<string, unknown> | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}

/**
 * Transform a Prisma notification to our result type
 */
function transformNotification(notification: {
  id: string
  orgId: string
  userId: string
  type: string
  title: string
  body: string | null
  actionUrl: string | null
  metadata: Prisma.JsonValue | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
}): NotificationResult {
  return {
    id: notification.id,
    orgId: notification.orgId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    metadata: notification.metadata as Record<string, unknown> | null,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification(input: CreateNotificationInput): Promise<NotificationResult> {
  // Support both `body` and `message` for backward compatibility
  const bodyContent = input.body ?? input.message

  const notification = await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type as PrismaNotificationType,
      title: input.title,
      body: bodyContent,
      actionUrl: input.actionUrl,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
  })

  return transformNotification(notification)
}

/**
 * Get a notification by ID
 */
export async function getNotification(id: string): Promise<NotificationResult | null> {
  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  return notification ? transformNotification(notification) : null
}

/**
 * List notifications for a user with cursor-based pagination
 */
export async function listNotifications(options: {
  userId: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
  cursor?: string
}): Promise<{
  items: NotificationResult[]
  total: number
  unreadCount: number
  cursor?: string
  hasMore: boolean
}> {
  const where: Prisma.NotificationWhereInput = {
    userId: options.userId,
  }

  if (options.unreadOnly) {
    where.isRead = false
  }

  const limit = options.limit ?? 20

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check if there are more
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1, // Skip the cursor item itself
          }
        : options.offset
          ? { skip: options.offset }
          : {}),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId: options.userId,
        isRead: false,
      },
    }),
  ])

  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1].id : undefined

  return {
    items: resultItems.map(transformNotification),
    total,
    unreadCount,
    cursor: nextCursor,
    hasMore,
  }
}

/**
 * Get notifications for a user (alias for listNotifications with different param names)
 */
export async function getNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; cursor?: string }
): Promise<{
  items: NotificationResult[]
  total: number
  unreadCount: number
  cursor?: string
  hasMore: boolean
}> {
  return listNotifications({
    userId,
    unreadOnly: options?.unreadOnly,
    limit: options?.limit,
    cursor: options?.cursor,
  })
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(id: string): Promise<NotificationResult> {
  const notification = await prisma.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return transformNotification(notification)
}

/**
 * Mark a notification as read (with user validation)
 */
export async function markAsRead(notificationId: string, userId: string): Promise<NotificationResult | null> {
  // First verify the notification belongs to the user
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  })

  if (!notification) {
    return null
  }

  return markNotificationRead(notificationId)
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return { count: result.count }
}

/**
 * Mark all notifications as read (alias)
 */
export async function markAllAsRead(userId: string): Promise<{ count: number }> {
  return markAllNotificationsRead(userId)
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<void> {
  await prisma.notification.delete({
    where: { id },
  })
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId: string): Promise<{ count: number }> {
  const result = await prisma.notification.deleteMany({
    where: { userId },
  })

  return { count: result.count }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  })
}

/**
 * Cleanup old read notifications
 */
export async function cleanupOldNotifications(options: {
  maxAgeDays?: number
  readOnly?: boolean
}): Promise<{ count: number }> {
  const maxAgeDays = options.maxAgeDays ?? 30
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

  const where: Prisma.NotificationWhereInput = {
    createdAt: { lt: cutoffDate },
  }

  if (options.readOnly) {
    where.isRead = true
  }

  const result = await prisma.notification.deleteMany({ where })
  return { count: result.count }
}

// ============================================
// CONVENIENCE FUNCTIONS FOR SPECIFIC NOTIFICATION TYPES
// ============================================

/**
 * Get user's orgId from the database
 */
async function getUserOrgId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  })

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  return user.orgId
}

/**
 * Notify user that a job completed successfully
 * @param userIdOrOrgId - Can be userId (for backward compat) or orgId (if userId also provided)
 * @param userIdOrJobType - Can be userId (if orgId provided) or jobType (backward compat)
 * @param jobTypeOrResult - Can be jobType (if orgId provided) or result (backward compat)
 * @param result - Optional result object (only used when all 4 args provided)
 */
export async function notifyJobCompleted(
  userIdOrOrgId: string,
  userIdOrJobType: string,
  jobTypeOrResult?: string | { count?: number; message?: string },
  result?: { count?: number; message?: string }
): Promise<NotificationResult> {
  // Determine if called with 3 args (old API) or 4 args (new API)
  let orgId: string
  let userId: string
  let jobType: string
  let finalResult: { count?: number; message?: string } | undefined

  if (typeof jobTypeOrResult === 'object' || jobTypeOrResult === undefined) {
    // Old API: notifyJobCompleted(userId, jobType, result?)
    userId = userIdOrOrgId
    jobType = userIdOrJobType
    finalResult = jobTypeOrResult as { count?: number; message?: string } | undefined
    orgId = await getUserOrgId(userId)
  } else {
    // New API: notifyJobCompleted(orgId, userId, jobType, result?)
    orgId = userIdOrOrgId
    userId = userIdOrJobType
    jobType = jobTypeOrResult
    finalResult = result
  }

  const messages: Record<string, string> = {
    'mass-note-batch': `Successfully created notes for ${finalResult?.count ?? 0} clients`,
    'form-conversion': 'Your form conversion is ready for review',
    'report-generation': 'Your report has been generated and is ready to download',
  }

  return createNotification({
    orgId,
    userId,
    type: 'SYSTEM',
    title: 'Job Completed',
    body: messages[jobType] ?? finalResult?.message ?? 'Your job has completed',
    metadata: { jobType, ...finalResult },
  })
}

/**
 * Notify user that a job failed
 * @param userIdOrOrgId - Can be userId (for backward compat) or orgId (if userId also provided)
 * @param jobTypeOrUserId - Can be jobType (backward compat) or userId (new API)
 * @param errorOrJobType - Can be error string (backward compat) or jobType (new API)
 * @param error - Error string (only used when all 4 args provided)
 */
export async function notifyJobFailed(
  userIdOrOrgId: string,
  jobTypeOrUserId: string,
  errorOrJobType: string,
  error?: string
): Promise<NotificationResult> {
  // Determine if called with 3 args (old API) or 4 args (new API)
  let orgId: string
  let userId: string
  let jobType: string
  let errorMessage: string

  if (error === undefined) {
    // Old API: notifyJobFailed(userId, jobType, error)
    userId = userIdOrOrgId
    jobType = jobTypeOrUserId
    errorMessage = errorOrJobType
    orgId = await getUserOrgId(userId)
  } else {
    // New API: notifyJobFailed(orgId, userId, jobType, error)
    orgId = userIdOrOrgId
    userId = jobTypeOrUserId
    jobType = errorOrJobType
    errorMessage = error
  }

  return createNotification({
    orgId,
    userId,
    type: 'SYSTEM',
    title: 'Job Failed',
    body: `An error occurred: ${errorMessage}`,
    metadata: { jobType, error: errorMessage },
  })
}

// ============================================
// NOTES FEATURE - MENTION & APPROVAL NOTIFICATIONS
// ============================================

/**
 * Create a notification when a user is mentioned in a note
 */
export async function createMentionNotification(
  noteId: string,
  mentionedUserId: string,
  authorName: string,
  clientName: string,
  clientId: string,
  orgId: string
): Promise<NotificationResult> {
  return createNotification({
    orgId,
    userId: mentionedUserId,
    type: 'MENTION',
    title: `${authorName} mentioned you in a note`,
    body: `You were mentioned in a note for client ${clientName}.`,
    actionUrl: `/clients/${clientId}?tab=notes&note=${noteId}`,
    metadata: {
      noteId,
      authorName,
      clientName,
      clientId,
    },
  })
}

/**
 * Create notifications for approvers when a shareable note needs approval
 */
export async function createApprovalRequestNotification(
  noteId: string,
  approverIds: string[],
  authorName: string,
  clientName: string,
  clientId: string,
  orgId: string
): Promise<NotificationResult[]> {
  const notifications = await Promise.all(
    approverIds.map((approverId) =>
      createNotification({
        orgId,
        userId: approverId,
        type: 'APPROVAL_REQUEST',
        title: 'Shareable note needs approval',
        body: `${authorName} submitted a shareable note for ${clientName} that requires your approval.`,
        actionUrl: `/admin?tab=note-approvals&note=${noteId}`,
        metadata: {
          noteId,
          authorName,
          clientName,
          clientId,
        },
      })
    )
  )

  return notifications
}

/**
 * Create a notification for the author when their note is approved or rejected
 */
export async function createApprovalResultNotification(
  noteId: string,
  authorId: string,
  approved: boolean,
  clientName: string,
  clientId: string,
  orgId: string,
  rejectionReason?: string
): Promise<NotificationResult> {
  const title = approved
    ? 'Your shareable note was approved'
    : 'Your shareable note was rejected'

  const body = approved
    ? `Your shareable note for ${clientName} has been approved and is now visible to the client.`
    : `Your shareable note for ${clientName} was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : 'Please review and resubmit.'}`

  return createNotification({
    orgId,
    userId: authorId,
    type: 'APPROVAL_RESULT',
    title,
    body,
    actionUrl: `/clients/${clientId}?tab=notes&note=${noteId}`,
    metadata: {
      noteId,
      approved,
      clientName,
      clientId,
      rejectionReason,
    },
  })
}

/**
 * Create a reminder notification (e.g., for clients without recent notes)
 */
export async function createReminderNotification(
  orgId: string,
  userId: string,
  title: string,
  body: string,
  actionUrl?: string,
  metadata?: Record<string, unknown>
): Promise<NotificationResult> {
  return createNotification({
    orgId,
    userId,
    type: 'REMINDER',
    title,
    body,
    actionUrl,
    metadata,
  })
}
