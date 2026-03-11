/**
 * Outlook Calendar Adapter
 *
 * Implements the CalendarAdapter interface for Microsoft Graph Calendar API.
 *
 * API Reference:
 * - Create event: POST /me/calendar/events
 * - Update event: PATCH /me/calendar/events/{eventId}
 * - Delete event: DELETE /me/calendar/events/{eventId}
 * - Check conflicts: GET /me/calendar/calendarView?startDateTime=X&endDateTime=Y
 */

import { CalendarProvider } from '@prisma/client'
import { createRateLimitedClient } from '@/lib/rate-limit/external-client'
import type {
  CalendarAdapter,
  CalendarEventInput,
  CreateEventResult,
  CheckConflictsResult,
  CalendarConflict,
  RecurrenceRule,
} from '../types'

// ============================================
// CONFIGURATION
// ============================================

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// ============================================
// TYPES
// ============================================

interface OutlookDateTimeZone {
  dateTime: string
  timeZone: string
}

interface OutlookAttendee {
  emailAddress: {
    address: string
    name?: string
  }
  type: 'required' | 'optional' | 'resource'
}

interface OutlookRecurrencePattern {
  type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly'
  interval: number
  daysOfWeek?: string[]
  dayOfMonth?: number
  firstDayOfWeek?: string
}

interface OutlookRecurrenceRange {
  type: 'endDate' | 'noEnd' | 'numbered'
  startDate: string
  endDate?: string
  numberOfOccurrences?: number
}

interface OutlookRecurrence {
  pattern: OutlookRecurrencePattern
  range: OutlookRecurrenceRange
}

interface OutlookCalendarEvent {
  id: string
  subject?: string
  body?: {
    contentType: 'text' | 'html'
    content: string
  }
  start: OutlookDateTimeZone
  end: OutlookDateTimeZone
  attendees?: OutlookAttendee[]
  location?: {
    displayName?: string
  }
  recurrence?: OutlookRecurrence
  isCancelled?: boolean
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown'
}

interface OutlookEventListResponse {
  value: OutlookCalendarEvent[]
  '@odata.nextLink'?: string
}

interface OutlookUserInfo {
  mail?: string
  userPrincipalName: string
  displayName?: string
}

// ============================================
// ADAPTER IMPLEMENTATION
// ============================================

export class OutlookCalendarAdapter implements CalendarAdapter {
  readonly provider = CalendarProvider.OUTLOOK

  /**
   * Create a single calendar event
   */
  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CreateEventResult> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const outlookEvent = this.toOutlookEvent(event)

    const response = await client.post<OutlookCalendarEvent>(
      `${GRAPH_API_BASE}/me/calendar/events`,
      outlookEvent
    )

    if (!response.success || !response.data) {
      console.error('[OutlookCalendar] Failed to create event:', response.error)
      return {
        success: false,
        error: response.error || 'Failed to create Outlook Calendar event',
      }
    }

    return {
      success: true,
      eventId: response.data.id,
    }
  }

  /**
   * Create a recurring event series
   */
  async createRecurringEvent(
    accessToken: string,
    event: CalendarEventInput,
    rule: RecurrenceRule
  ): Promise<CreateEventResult> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const outlookEvent = this.toOutlookEvent(event)

    // Add recurrence pattern
    outlookEvent.recurrence = this.toOutlookRecurrence(event.startTime, rule)

    const response = await client.post<OutlookCalendarEvent>(
      `${GRAPH_API_BASE}/me/calendar/events`,
      outlookEvent
    )

    if (!response.success || !response.data) {
      console.error('[OutlookCalendar] Failed to create recurring event:', response.error)
      return {
        success: false,
        error: response.error || 'Failed to create recurring event',
      }
    }

    return {
      success: true,
      eventId: response.data.id,
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<{ success: boolean; error?: string }> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const outlookEvent = this.toOutlookEventPartial(event)

    const response = await client.patch<OutlookCalendarEvent>(
      `${GRAPH_API_BASE}/me/calendar/events/${encodeURIComponent(eventId)}`,
      outlookEvent
    )

    if (!response.success) {
      console.error('[OutlookCalendar] Failed to update event:', response.error)
      return {
        success: false,
        error: response.error || 'Failed to update event',
      }
    }

    return { success: true }
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    accessToken: string,
    eventId: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const response = await client.delete(
      `${GRAPH_API_BASE}/me/calendar/events/${encodeURIComponent(eventId)}`
    )

    // Microsoft returns 204 No Content on successful delete
    if (!response.success && response.status !== 204) {
      console.error('[OutlookCalendar] Failed to delete event:', response.error)
      return {
        success: false,
        error: response.error || 'Failed to delete event',
      }
    }

    return { success: true }
  }

  /**
   * Check for conflicts at a specific time
   */
  async checkConflicts(
    accessToken: string,
    startTime: Date,
    endTime: Date
  ): Promise<CheckConflictsResult> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    // Use calendarView to get expanded recurring events
    const params = new URLSearchParams({
      startDateTime: startTime.toISOString(),
      endDateTime: endTime.toISOString(),
      $select: 'id,subject,start,end,isCancelled,showAs',
    })

    const response = await client.get<OutlookEventListResponse>(
      `${GRAPH_API_BASE}/me/calendar/calendarView?${params.toString()}`
    )

    if (!response.success || !response.data) {
      console.error('[OutlookCalendar] Failed to check conflicts:', response.error)
      return {
        hasConflict: false,
        conflicts: [],
      }
    }

    const conflicts: CalendarConflict[] = response.data.value
      .filter((event) => !event.isCancelled && event.showAs !== 'free')
      .map((event) => this.toCalendarConflict(event))

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    }
  }

  /**
   * Get user's calendar email/account info
   */
  async getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    const client = createRateLimitedClient('outlook-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const response = await client.get<OutlookUserInfo>(
      `${GRAPH_API_BASE}/me?$select=mail,userPrincipalName,displayName`
    )

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user info')
    }

    return {
      email: response.data.mail || response.data.userPrincipalName,
      name: response.data.displayName,
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Convert CalendarEventInput to Outlook event format
   */
  private toOutlookEvent(event: CalendarEventInput): Omit<OutlookCalendarEvent, 'id'> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const endTime = event.endTime || new Date(event.startTime.getTime() + DEFAULT_EVENT_DURATION_MS)

    return {
      subject: event.title,
      body: event.description
        ? {
            contentType: 'text',
            content: event.description,
          }
        : undefined,
      start: {
        dateTime: this.toLocalISOString(event.startTime),
        timeZone,
      },
      end: {
        dateTime: this.toLocalISOString(endTime),
        timeZone,
      },
      attendees: event.attendees?.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: 'required' as const,
      })),
      location: event.location
        ? {
            displayName: event.location,
          }
        : undefined,
    }
  }

  /**
   * Convert partial CalendarEventInput to Outlook event format for updates
   */
  private toOutlookEventPartial(
    event: Partial<CalendarEventInput>
  ): Partial<Omit<OutlookCalendarEvent, 'id'>> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const result: Partial<Omit<OutlookCalendarEvent, 'id'>> = {}

    if (event.title !== undefined) {
      result.subject = event.title
    }
    if (event.description !== undefined) {
      result.body = {
        contentType: 'text',
        content: event.description,
      }
    }
    if (event.startTime !== undefined) {
      result.start = {
        dateTime: this.toLocalISOString(event.startTime),
        timeZone,
      }
    }
    if (event.endTime !== undefined) {
      result.end = {
        dateTime: this.toLocalISOString(event.endTime),
        timeZone,
      }
    }
    if (event.attendees !== undefined) {
      result.attendees = event.attendees.map((a) => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: 'required' as const,
      }))
    }
    if (event.location !== undefined) {
      result.location = {
        displayName: event.location,
      }
    }

    return result
  }

  /**
   * Convert RecurrenceRule to Outlook recurrence format
   */
  private toOutlookRecurrence(
    startDate: Date,
    rule: RecurrenceRule
  ): OutlookRecurrence {
    // Map frequency to Outlook pattern type
    const patternTypeMap: Record<RecurrenceRule['frequency'], OutlookRecurrencePattern['type']> = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      BIWEEKLY: 'weekly',
      MONTHLY: 'absoluteMonthly',
    }

    // Map days of week to Outlook format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    const pattern: OutlookRecurrencePattern = {
      type: patternTypeMap[rule.frequency],
      interval: rule.frequency === 'BIWEEKLY' ? 2 : rule.interval || 1,
    }

    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      pattern.daysOfWeek = rule.daysOfWeek.map((d) => dayNames[d])
    }

    if (rule.frequency === 'MONTHLY') {
      pattern.dayOfMonth = startDate.getDate()
    }

    // Build recurrence range
    const range: OutlookRecurrenceRange = {
      type: rule.count ? 'numbered' : rule.until ? 'endDate' : 'noEnd',
      startDate: this.toDateOnlyString(startDate),
    }

    if (rule.until) {
      range.endDate = this.toDateOnlyString(rule.until)
    }

    if (rule.count) {
      range.numberOfOccurrences = rule.count
    }

    return { pattern, range }
  }

  /**
   * Convert Outlook event to CalendarConflict
   */
  private toCalendarConflict(event: OutlookCalendarEvent): CalendarConflict {
    return {
      eventId: event.id,
      title: event.subject || 'Busy',
      startTime: new Date(event.start.dateTime),
      endTime: new Date(event.end.dateTime),
    }
  }

  /**
   * Convert Date to local ISO string without timezone offset (required by Microsoft Graph)
   */
  private toLocalISOString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  }

  /**
   * Convert Date to date-only string (YYYY-MM-DD)
   */
  private toDateOnlyString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }
}

// Singleton instance
export const outlookCalendarAdapter = new OutlookCalendarAdapter()
