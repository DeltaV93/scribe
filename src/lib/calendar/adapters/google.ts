/**
 * Google Calendar Adapter
 *
 * Implements the CalendarAdapter interface for Google Calendar API v3.
 *
 * API Reference:
 * - Create event: POST /calendars/primary/events
 * - Update event: PATCH /calendars/primary/events/{eventId}
 * - Delete event: DELETE /calendars/primary/events/{eventId}
 * - Check conflicts: GET /calendars/primary/events?timeMin=X&timeMax=Y
 */

import { CalendarProvider } from '@prisma/client'
import { createRateLimitedClient } from '@/lib/rate-limit/external-client'
import { toRRule } from '../types'
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

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// ============================================
// TYPES
// ============================================

interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  location?: string
  recurrence?: string[]
  status?: string
}

interface GoogleEventListResponse {
  kind: string
  items: GoogleCalendarEvent[]
  nextPageToken?: string
}

interface GoogleUserInfo {
  email: string
  name?: string
}

// ============================================
// ADAPTER IMPLEMENTATION
// ============================================

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = CalendarProvider.GOOGLE

  /**
   * Create a single calendar event
   */
  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CreateEventResult> {
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const googleEvent = this.toGoogleEvent(event)

    const response = await client.post<GoogleCalendarEvent>(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`,
      googleEvent
    )

    if (!response.success || !response.data) {
      console.error('[GoogleCalendar] Failed to create event:', response.error)
      return {
        success: false,
        error: response.error || 'Failed to create Google Calendar event',
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
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const googleEvent = this.toGoogleEvent(event)

    // Add recurrence rule in iCal RRULE format
    googleEvent.recurrence = [`RRULE:${toRRule(rule)}`]

    const response = await client.post<GoogleCalendarEvent>(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`,
      googleEvent
    )

    if (!response.success || !response.data) {
      console.error('[GoogleCalendar] Failed to create recurring event:', response.error)
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
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const googleEvent = this.toGoogleEventPartial(event)

    const response = await client.patch<GoogleCalendarEvent>(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
      googleEvent
    )

    if (!response.success) {
      console.error('[GoogleCalendar] Failed to update event:', response.error)
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
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const response = await client.delete(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`
    )

    // Google returns 204 No Content on successful delete
    // Our client treats 2xx as success
    if (!response.success && response.status !== 204) {
      console.error('[GoogleCalendar] Failed to delete event:', response.error)
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
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const params = new URLSearchParams({
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: 'true', // Expand recurring events
      orderBy: 'startTime',
    })

    const response = await client.get<GoogleEventListResponse>(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`
    )

    if (!response.success || !response.data) {
      console.error('[GoogleCalendar] Failed to check conflicts:', response.error)
      return {
        hasConflict: false,
        conflicts: [],
      }
    }

    const conflicts: CalendarConflict[] = response.data.items
      .filter((event) => event.status !== 'cancelled')
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
    const client = createRateLimitedClient('google-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const response = await client.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v2/userinfo'
    )

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get user info')
    }

    return {
      email: response.data.email,
      name: response.data.name,
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Convert CalendarEventInput to Google Calendar event format
   */
  private toGoogleEvent(event: CalendarEventInput): Omit<GoogleCalendarEvent, 'id'> {
    const endTime = event.endTime || new Date(event.startTime.getTime() + DEFAULT_EVENT_DURATION_MS)

    return {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name,
      })),
      location: event.location,
    }
  }

  /**
   * Convert partial CalendarEventInput to Google Calendar event format for updates
   */
  private toGoogleEventPartial(
    event: Partial<CalendarEventInput>
  ): Partial<Omit<GoogleCalendarEvent, 'id'>> {
    const result: Partial<Omit<GoogleCalendarEvent, 'id'>> = {}

    if (event.title !== undefined) {
      result.summary = event.title
    }
    if (event.description !== undefined) {
      result.description = event.description
    }
    if (event.startTime !== undefined) {
      result.start = {
        dateTime: event.startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }
    if (event.endTime !== undefined) {
      result.end = {
        dateTime: event.endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    }
    if (event.attendees !== undefined) {
      result.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.name,
      }))
    }
    if (event.location !== undefined) {
      result.location = event.location
    }

    return result
  }

  /**
   * Convert Google Calendar event to CalendarConflict
   */
  private toCalendarConflict(event: GoogleCalendarEvent): CalendarConflict {
    return {
      eventId: event.id,
      title: event.summary || 'Busy',
      startTime: new Date(event.start.dateTime || event.start.date || ''),
      endTime: new Date(event.end.dateTime || event.end.date || ''),
    }
  }
}

// Singleton instance
export const googleCalendarAdapter = new GoogleCalendarAdapter()
