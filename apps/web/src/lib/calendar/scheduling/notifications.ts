/**
 * Calendar Scheduling Notifications
 *
 * Helper functions for creating notifications related to calendar integration
 * and event scheduling. Uses the existing notification service.
 */

import { createNotification } from '@/lib/services/notifications'
import type { CalendarProvider } from '@prisma/client'
import { format } from 'date-fns'

// ============================================
// NOTIFICATION CREATION HELPERS
// ============================================

/**
 * Create a notification when a Tier 1 event is auto-created on the calendar
 *
 * @param userId - The user who owns the calendar
 * @param orgId - Organization ID
 * @param callId - The call that triggered the event
 * @param clientName - Name of the client for the event
 * @param eventDateTime - The scheduled date/time of the event
 * @param eventTitle - Title of the created event
 */
export async function createCalendarEventNotification(
  userId: string,
  orgId: string,
  callId: string,
  clientName: string,
  eventDateTime: Date,
  eventTitle?: string
): Promise<void> {
  const formattedDate = format(eventDateTime, "EEEE, MMMM d 'at' h:mm a")
  const title = eventTitle || `Follow-up with ${clientName}`

  await createNotification({
    orgId,
    userId,
    type: 'CALENDAR_EVENT_CREATED',
    title: 'Calendar event created',
    body: `"${title}" scheduled for ${formattedDate}`,
    actionUrl: `/calls/${callId}`,
    metadata: {
      callId,
      clientName,
      eventDateTime: eventDateTime.toISOString(),
      eventTitle: title,
    },
  })
}

/**
 * Create a notification when a Tier 2 item needs manual review
 *
 * @param userId - The user who needs to review
 * @param orgId - Organization ID
 * @param callId - The call that has pending items
 * @param clientName - Name of the client from the call
 * @param pendingCount - Number of pending items (optional, for bulk notification)
 */
export async function createPendingReviewNotification(
  userId: string,
  orgId: string,
  callId: string,
  clientName: string,
  pendingCount?: number
): Promise<void> {
  const count = pendingCount ?? 1
  const body =
    count === 1
      ? `Review scheduling for call with ${clientName}`
      : `${count} scheduling items need review from call with ${clientName}`

  await createNotification({
    orgId,
    userId,
    type: 'CALENDAR_PENDING_REVIEW',
    title: 'Schedule review needed',
    body,
    actionUrl: `/calls/${callId}`,
    metadata: {
      callId,
      clientName,
      pendingCount: count,
    },
  })
}

/**
 * Create a notification when calendar integration has an error
 *
 * This is used when:
 * - OAuth token refresh fails
 * - Calendar API returns an error
 * - Integration needs to be reconnected
 *
 * @param userId - The user whose calendar has the issue
 * @param orgId - Organization ID
 * @param provider - The calendar provider (GOOGLE, OUTLOOK, APPLE)
 * @param error - Description of the error
 */
export async function createIntegrationErrorNotification(
  userId: string,
  orgId: string,
  provider: CalendarProvider,
  error: string
): Promise<void> {
  const providerName = {
    GOOGLE: 'Google Calendar',
    OUTLOOK: 'Outlook Calendar',
    APPLE: 'Apple Calendar',
  }[provider]

  await createNotification({
    orgId,
    userId,
    type: 'INTEGRATION_ERROR',
    title: 'Calendar disconnected',
    body: `Your ${providerName} connection expired or encountered an error. Please reconnect to continue auto-scheduling.`,
    actionUrl: '/settings/integrations',
    metadata: {
      provider,
      providerName,
      error,
      reconnectRequired: true,
    },
  })
}

// ============================================
// BATCH NOTIFICATION HELPERS
// ============================================

/**
 * Create notifications for all Tier 1 events created from a single call
 *
 * This is more efficient than creating individual notifications for each event.
 *
 * @param userId - The user who owns the calendar
 * @param orgId - Organization ID
 * @param callId - The call that triggered the events
 * @param clientName - Name of the client
 * @param events - Array of created events
 */
export async function createBatchEventNotifications(
  userId: string,
  orgId: string,
  callId: string,
  clientName: string,
  events: Array<{
    title: string
    dateTime: Date
  }>
): Promise<void> {
  if (events.length === 0) return

  if (events.length === 1) {
    // Single event - use detailed notification
    await createCalendarEventNotification(
      userId,
      orgId,
      callId,
      clientName,
      events[0].dateTime,
      events[0].title
    )
    return
  }

  // Multiple events - use summary notification
  const eventSummary = events
    .map((e) => format(e.dateTime, "MMM d 'at' h:mm a"))
    .join(', ')

  await createNotification({
    orgId,
    userId,
    type: 'CALENDAR_EVENT_CREATED',
    title: `${events.length} calendar events created`,
    body: `Follow-ups with ${clientName} scheduled for ${eventSummary}`,
    actionUrl: `/calls/${callId}`,
    metadata: {
      callId,
      clientName,
      eventCount: events.length,
      events: events.map((e) => ({
        title: e.title,
        dateTime: e.dateTime.toISOString(),
      })),
    },
  })
}

/**
 * Create notification for Tier 1 conflict
 *
 * When auto-scheduling fails due to a calendar conflict
 *
 * @param userId - The user who owns the calendar
 * @param orgId - Organization ID
 * @param callId - The call that triggered the event
 * @param clientName - Name of the client
 * @param conflictingEventTitle - Title of the conflicting event
 * @param conflictingEventTime - Time of the conflicting event
 */
export async function createConflictNotification(
  userId: string,
  orgId: string,
  callId: string,
  clientName: string,
  conflictingEventTitle: string,
  conflictingEventTime: Date
): Promise<void> {
  const formattedTime = format(conflictingEventTime, "h:mm a 'on' EEEE, MMMM d")

  await createNotification({
    orgId,
    userId,
    type: 'CALENDAR_PENDING_REVIEW',
    title: 'Calendar conflict detected',
    body: `Could not auto-schedule follow-up with ${clientName}. Conflicts with "${conflictingEventTitle}" at ${formattedTime}.`,
    actionUrl: `/calls/${callId}`,
    metadata: {
      callId,
      clientName,
      conflictingEventTitle,
      conflictingEventTime: conflictingEventTime.toISOString(),
      isConflict: true,
    },
  })
}
