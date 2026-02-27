/**
 * Tier 1 Scheduling Processor
 *
 * Handles auto-scheduling for action items with explicit date/time.
 * Checks for calendar conflicts and either creates the event or
 * routes to Tier 2 with conflict details.
 */

import { prisma } from '@/lib/db'
import {
  CalendarProvider,
  CalendarEventStatus,
  PendingSchedulingTier,
  PendingSchedulingStatus,
  CalendarIntegrationStatus,
} from '@prisma/client'
import { createAuditLog } from '@/lib/audit/service'
import type {
  CalendarConflict,
  RecurrenceRule,
  CalendarEventInput,
} from '../types'
import { toRRule } from '../types'
import { getCalendarAccessToken } from '../service'
import { createCalendarAdapter } from '../adapters'

// ============================================
// TYPES
// ============================================

export interface Tier1ProcessInput {
  callId: string
  userId: string
  orgId: string
  clientId?: string
  clientName: string
  dateTime: Date
  duration?: number // minutes, default 30
  recurrence?: RecurrenceRule
  context: string
  actionItemId?: string
}

export interface Tier1ProcessResult {
  success: boolean
  eventId?: string
  calendarEventId?: string // Internal DB ID
  conflict?: CalendarConflict
  pendingItemId?: string // Created if conflict
  error?: string
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_DURATION_MINUTES = 30
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.scrybe.io'

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process a Tier 1 scheduling item (explicit date/time)
 *
 * Flow:
 * 1. Get user's calendar integration
 * 2. Create adapter and check for conflicts
 * 3. If conflict: create PendingSchedulingItem with TIER_1_CONFLICT
 * 4. If no conflict: create calendar event, store in DB
 * 5. Create HIPAA audit log
 */
export async function processTier1Item(
  input: Tier1ProcessInput
): Promise<Tier1ProcessResult> {
  const {
    callId,
    userId,
    orgId,
    clientId,
    clientName,
    dateTime,
    duration = DEFAULT_DURATION_MINUTES,
    recurrence,
    context,
    actionItemId,
  } = input

  try {
    // Step 1: Get user's calendar integration
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId },
      include: { integrationToken: true },
    })

    if (!integration || integration.status !== CalendarIntegrationStatus.ACTIVE) {
      return {
        success: false,
        error: 'No active calendar integration found. Please connect a calendar in Settings.',
      }
    }

    // Step 2: Get access token
    const accessToken = await getCalendarAccessToken(userId)
    if (!accessToken) {
      return {
        success: false,
        error: 'Failed to retrieve calendar access token. Please reconnect your calendar.',
      }
    }

    // Step 3: Create adapter
    const adapter = createCalendarAdapter(integration.provider)

    // Step 4: Calculate end time
    const startTime = dateTime
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    // Step 5: Check for conflicts
    const conflictResult = await adapter.checkConflicts(accessToken, startTime, endTime)

    if (conflictResult.hasConflict && conflictResult.conflicts.length > 0) {
      // Route to Tier 2 with conflict details
      const conflict = conflictResult.conflicts[0]

      const pendingItem = await prisma.pendingSchedulingItem.create({
        data: {
          callId,
          userId,
          orgId,
          clientId,
          clientName: extractFirstName(clientName),
          extractedContext: context,
          extractedDateHint: formatDateHint(dateTime),
          hasRecurrence: !!recurrence,
          recurrencePattern: recurrence ? formatRecurrencePattern(recurrence) : null,
          tier: PendingSchedulingTier.TIER_1_CONFLICT,
          conflictDetails: {
            conflictingEventTitle: conflict.title,
            conflictingEventTime: conflict.startTime.toISOString(),
            conflictingEventId: conflict.eventId,
          },
          status: PendingSchedulingStatus.PENDING,
        },
      })

      return {
        success: false,
        conflict,
        pendingItemId: pendingItem.id,
      }
    }

    // Step 6: No conflict - create calendar event
    const eventInput: CalendarEventInput = {
      title: buildEventTitle(clientName),
      description: buildEventDescription(callId),
      startTime,
      endTime,
      attendees: await getClientAttendee(clientId, integration.clientAutoInvite),
      recurrence,
    }

    let createResult
    if (recurrence) {
      createResult = await adapter.createRecurringEvent(accessToken, eventInput, recurrence)
    } else {
      createResult = await adapter.createEvent(accessToken, eventInput)
    }

    if (!createResult.success || !createResult.eventId) {
      return {
        success: false,
        error: createResult.error || 'Failed to create calendar event',
      }
    }

    // Step 7: Store CalendarEvent in DB
    const calendarEvent = await prisma.calendarEvent.create({
      data: {
        userId,
        orgId,
        callId,
        clientId,
        externalEventId: createResult.eventId,
        provider: integration.provider,
        title: eventInput.title,
        startTime,
        endTime,
        isRecurring: !!recurrence,
        rrule: recurrence ? toRRule(recurrence) : null,
        clientInvited: eventInput.attendees && eventInput.attendees.length > 0,
        status: CalendarEventStatus.CREATED,
        calendarIntegrationId: integration.id,
        actionItemId,
      },
    })

    // Step 8: Create HIPAA audit log
    await createAuditLog({
      orgId,
      userId,
      action: 'CREATE',
      resource: 'CALENDAR_EVENT',
      resourceId: calendarEvent.id,
      resourceName: eventInput.title,
      details: {
        type: 'CALENDAR_EVENT_CREATED',
        callId,
        clientId,
        externalEventId: createResult.eventId,
        provider: integration.provider,
        isRecurring: !!recurrence,
        tier: 'TIER_1_AUTO',
      },
    })

    return {
      success: true,
      eventId: createResult.eventId,
      calendarEventId: calendarEvent.id,
    }
  } catch (error) {
    console.error('[Tier1Processor] Error processing item:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract first name from full client name
 */
function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[0] || fullName
}

/**
 * Build calendar event title
 */
function buildEventTitle(clientName: string): string {
  const firstName = extractFirstName(clientName)
  return `Scrybe: Follow-up with ${firstName}`
}

/**
 * Build calendar event description with deep link
 */
function buildEventDescription(callId: string): string {
  return `View interaction: ${APP_URL}/calls/${callId}`
}

/**
 * Format date for date hint display
 */
function formatDateHint(date: Date): string {
  return date.toISOString()
}

/**
 * Format recurrence rule for display
 */
function formatRecurrencePattern(rule: RecurrenceRule): string {
  let pattern = rule.frequency.toLowerCase()

  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const days = rule.daysOfWeek.map((d) => dayNames[d]).join(', ')
    pattern = `${pattern} on ${days}`
  }

  if (rule.until) {
    pattern = `${pattern} until ${rule.until.toLocaleDateString()}`
  }

  return pattern
}

/**
 * Get client email for invitation if auto-invite is enabled
 */
async function getClientAttendee(
  clientId: string | undefined,
  autoInvite: boolean
): Promise<Array<{ email: string; name?: string }>> {
  if (!clientId || !autoInvite) {
    return []
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
    },
  })

  if (!client?.email) {
    return []
  }

  return [
    {
      email: client.email,
      name: `${client.firstName} ${client.lastName}`.trim(),
    },
  ]
}
