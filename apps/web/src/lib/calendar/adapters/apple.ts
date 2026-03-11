/**
 * Apple Calendar Adapter (CalDAV)
 *
 * Implements the CalendarAdapter interface for Apple iCloud Calendar via CalDAV.
 *
 * Note: Apple Calendar uses CalDAV (WebDAV extension) with VCALENDAR/VEVENT format.
 * This implementation uses raw HTTP requests with XML/iCal payloads since tsdav
 * library is not available.
 *
 * CalDAV endpoints:
 * - Calendar home: https://caldav.icloud.com/{user}/calendars/
 * - Create event: PUT /calendars/{calendar-id}/{event-uid}.ics
 * - Update event: PUT /calendars/{calendar-id}/{event-uid}.ics
 * - Delete event: DELETE /calendars/{calendar-id}/{event-uid}.ics
 * - Query events: REPORT /calendars/{calendar-id}/ with calendar-query
 */

import { CalendarProvider } from '@prisma/client'
import { createRateLimitedClient } from '@/lib/rate-limit/external-client'
import { nanoid } from 'nanoid'
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

const CALDAV_BASE = 'https://caldav.icloud.com'
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// ============================================
// ADAPTER IMPLEMENTATION
// ============================================

export class AppleCalendarAdapter implements CalendarAdapter {
  readonly provider = CalendarProvider.APPLE

  /**
   * Create a single calendar event
   *
   * Note: For Apple Calendar, the accessToken is actually a base64-encoded
   * string in format "email:app-specific-password"
   */
  async createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CreateEventResult> {
    try {
      const calendarUrl = await this.getDefaultCalendarUrl(accessToken)
      if (!calendarUrl) {
        return {
          success: false,
          error: 'Could not find default calendar',
        }
      }

      const eventUid = `${nanoid()}-scrybe`
      const vcalendar = this.toVCalendar(event, eventUid)

      const client = createRateLimitedClient('apple-calendar', 'system', {
        defaultHeaders: {
          Authorization: `Basic ${accessToken}`,
          'Content-Type': 'text/calendar; charset=utf-8',
        },
      })

      const eventUrl = `${calendarUrl}${eventUid}.ics`
      const response = await client.fetch(eventUrl, {
        method: 'PUT',
        body: vcalendar,
      })

      // CalDAV returns 201 Created or 204 No Content on success
      if (!response.success && response.status !== 201 && response.status !== 204) {
        console.error('[AppleCalendar] Failed to create event:', response.error)
        return {
          success: false,
          error: response.error || 'Failed to create Apple Calendar event',
        }
      }

      return {
        success: true,
        eventId: eventUid,
      }
    } catch (error) {
      console.error('[AppleCalendar] Error creating event:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
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
    try {
      const calendarUrl = await this.getDefaultCalendarUrl(accessToken)
      if (!calendarUrl) {
        return {
          success: false,
          error: 'Could not find default calendar',
        }
      }

      const eventUid = `${nanoid()}-scrybe`
      const vcalendar = this.toVCalendar(event, eventUid, rule)

      const client = createRateLimitedClient('apple-calendar', 'system', {
        defaultHeaders: {
          Authorization: `Basic ${accessToken}`,
          'Content-Type': 'text/calendar; charset=utf-8',
        },
      })

      const eventUrl = `${calendarUrl}${eventUid}.ics`
      const response = await client.fetch(eventUrl, {
        method: 'PUT',
        body: vcalendar,
      })

      if (!response.success && response.status !== 201 && response.status !== 204) {
        console.error('[AppleCalendar] Failed to create recurring event:', response.error)
        return {
          success: false,
          error: response.error || 'Failed to create recurring event',
        }
      }

      return {
        success: true,
        eventId: eventUid,
      }
    } catch (error) {
      console.error('[AppleCalendar] Error creating recurring event:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
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
    try {
      const calendarUrl = await this.getDefaultCalendarUrl(accessToken)
      if (!calendarUrl) {
        return {
          success: false,
          error: 'Could not find default calendar',
        }
      }

      // First, fetch the existing event
      const existingEvent = await this.getEvent(accessToken, calendarUrl, eventId)
      if (!existingEvent) {
        return {
          success: false,
          error: 'Event not found',
        }
      }

      // Merge updates with existing event
      const mergedEvent: CalendarEventInput = {
        title: event.title ?? existingEvent.title,
        description: event.description ?? existingEvent.description,
        startTime: event.startTime ?? existingEvent.startTime,
        endTime: event.endTime ?? existingEvent.endTime,
        attendees: event.attendees ?? existingEvent.attendees,
        location: event.location ?? existingEvent.location,
      }

      const vcalendar = this.toVCalendar(mergedEvent, eventId)

      const client = createRateLimitedClient('apple-calendar', 'system', {
        defaultHeaders: {
          Authorization: `Basic ${accessToken}`,
          'Content-Type': 'text/calendar; charset=utf-8',
        },
      })

      const eventUrl = `${calendarUrl}${eventId}.ics`
      const response = await client.fetch(eventUrl, {
        method: 'PUT',
        body: vcalendar,
      })

      if (!response.success && response.status !== 201 && response.status !== 204) {
        console.error('[AppleCalendar] Failed to update event:', response.error)
        return {
          success: false,
          error: response.error || 'Failed to update event',
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[AppleCalendar] Error updating event:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    accessToken: string,
    eventId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const calendarUrl = await this.getDefaultCalendarUrl(accessToken)
      if (!calendarUrl) {
        return {
          success: false,
          error: 'Could not find default calendar',
        }
      }

      const client = createRateLimitedClient('apple-calendar', 'system', {
        defaultHeaders: {
          Authorization: `Basic ${accessToken}`,
        },
      })

      const eventUrl = `${calendarUrl}${eventId}.ics`
      const response = await client.delete(eventUrl)

      // CalDAV returns 204 No Content on successful delete
      if (!response.success && response.status !== 204) {
        console.error('[AppleCalendar] Failed to delete event:', response.error)
        return {
          success: false,
          error: response.error || 'Failed to delete event',
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[AppleCalendar] Error deleting event:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Check for conflicts at a specific time
   */
  async checkConflicts(
    accessToken: string,
    startTime: Date,
    endTime: Date
  ): Promise<CheckConflictsResult> {
    try {
      const calendarUrl = await this.getDefaultCalendarUrl(accessToken)
      if (!calendarUrl) {
        return {
          hasConflict: false,
          conflicts: [],
        }
      }

      const conflicts = await this.queryEvents(accessToken, calendarUrl, startTime, endTime)

      return {
        hasConflict: conflicts.length > 0,
        conflicts,
      }
    } catch (error) {
      console.error('[AppleCalendar] Error checking conflicts:', error)
      return {
        hasConflict: false,
        conflicts: [],
      }
    }
  }

  /**
   * Get user's calendar email/account info
   *
   * For Apple Calendar, we extract the email from the credentials
   */
  async getUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    // accessToken is base64-encoded "email:password"
    const decoded = Buffer.from(accessToken, 'base64').toString('utf-8')
    const [email] = decoded.split(':')

    if (!email) {
      throw new Error('Invalid credentials format')
    }

    return { email }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Get the default calendar URL for the user
   */
  private async getDefaultCalendarUrl(accessToken: string): Promise<string | null> {
    try {
      // First, get the user's principal URL
      const principalUrl = await this.getPrincipalUrl(accessToken)
      if (!principalUrl) {
        return null
      }

      // Then, get the calendar home set
      const calendarHomeUrl = await this.getCalendarHomeSet(accessToken, principalUrl)
      if (!calendarHomeUrl) {
        return null
      }

      // Finally, get the default calendar
      return await this.getDefaultCalendar(accessToken, calendarHomeUrl)
    } catch (error) {
      console.error('[AppleCalendar] Error getting calendar URL:', error)
      return null
    }
  }

  /**
   * Get the user's principal URL via PROPFIND
   */
  private async getPrincipalUrl(accessToken: string): Promise<string | null> {
    const client = createRateLimitedClient('apple-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Basic ${accessToken}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
      },
    })

    const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>`

    const response = await client.fetch(`${CALDAV_BASE}/`, {
      method: 'PROPFIND',
      body: propfindBody,
    })

    if (!response.success || response.status !== 207) {
      return null
    }

    // Parse XML response to extract principal URL
    const xmlData = response.data as string
    const match = xmlData?.match(/<D:href>([^<]+)<\/D:href>/i)
    if (match && match[1]) {
      const href = match[1]
      return href.startsWith('http') ? href : `${CALDAV_BASE}${href}`
    }

    return null
  }

  /**
   * Get the calendar home set URL
   */
  private async getCalendarHomeSet(
    accessToken: string,
    principalUrl: string
  ): Promise<string | null> {
    const client = createRateLimitedClient('apple-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Basic ${accessToken}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '0',
      },
    })

    const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`

    const response = await client.fetch(principalUrl, {
      method: 'PROPFIND',
      body: propfindBody,
    })

    if (!response.success || response.status !== 207) {
      return null
    }

    // Parse XML response to extract calendar home URL
    const xmlData = response.data as string
    const match = xmlData?.match(/<C:calendar-home-set[^>]*>[\s\S]*?<D:href>([^<]+)<\/D:href>/i)
    if (match && match[1]) {
      const href = match[1]
      return href.startsWith('http') ? href : `${CALDAV_BASE}${href}`
    }

    return null
  }

  /**
   * Get the default calendar URL from the calendar home
   */
  private async getDefaultCalendar(
    accessToken: string,
    calendarHomeUrl: string
  ): Promise<string | null> {
    const client = createRateLimitedClient('apple-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Basic ${accessToken}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
    })

    const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
  </D:prop>
</D:propfind>`

    const response = await client.fetch(calendarHomeUrl, {
      method: 'PROPFIND',
      body: propfindBody,
    })

    if (!response.success || response.status !== 207) {
      return null
    }

    // Parse XML response to find the first calendar
    const xmlData = response.data as string

    // Look for a response that has calendar resourcetype
    const calendarMatch = xmlData?.match(
      /<D:response>[\s\S]*?<D:href>([^<]+)<\/D:href>[\s\S]*?<C:calendar\s*\/>[\s\S]*?<\/D:response>/i
    )

    if (calendarMatch && calendarMatch[1]) {
      const href = calendarMatch[1]
      return href.startsWith('http') ? href : `${CALDAV_BASE}${href}`
    }

    // Fallback: use the calendar home URL with a default calendar name
    return `${calendarHomeUrl}calendar/`
  }

  /**
   * Get a single event by UID
   */
  private async getEvent(
    accessToken: string,
    calendarUrl: string,
    eventId: string
  ): Promise<CalendarEventInput | null> {
    const client = createRateLimitedClient('apple-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Basic ${accessToken}`,
      },
    })

    const eventUrl = `${calendarUrl}${eventId}.ics`
    const response = await client.get<string>(eventUrl)

    if (!response.success || !response.data) {
      return null
    }

    return this.parseVCalendar(response.data as string)
  }

  /**
   * Query events in a time range using REPORT
   */
  private async queryEvents(
    accessToken: string,
    calendarUrl: string,
    startTime: Date,
    endTime: Date
  ): Promise<CalendarConflict[]> {
    const client = createRateLimitedClient('apple-calendar', 'system', {
      defaultHeaders: {
        Authorization: `Basic ${accessToken}`,
        'Content-Type': 'application/xml; charset=utf-8',
        Depth: '1',
      },
    })

    const startStr = this.toICalDateTime(startTime)
    const endStr = this.toICalDateTime(endTime)

    const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${startStr}" end="${endStr}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`

    const response = await client.fetch(calendarUrl, {
      method: 'REPORT',
      body: reportBody,
    })

    if (!response.success || response.status !== 207) {
      return []
    }

    // Parse the multi-status response
    const conflicts: CalendarConflict[] = []
    const xmlData = response.data as string

    // Extract calendar-data from each response
    const calendarDataMatches = xmlData?.matchAll(
      /<C:calendar-data[^>]*>([\s\S]*?)<\/C:calendar-data>/gi
    )

    if (calendarDataMatches) {
      for (const match of calendarDataMatches) {
        const vcalData = match[1]?.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        if (vcalData) {
          const event = this.parseVCalendarForConflict(vcalData)
          if (event) {
            conflicts.push(event)
          }
        }
      }
    }

    return conflicts
  }

  /**
   * Convert CalendarEventInput to VCALENDAR format
   */
  private toVCalendar(
    event: CalendarEventInput,
    uid: string,
    recurrence?: RecurrenceRule
  ): string {
    const endTime = event.endTime || new Date(event.startTime.getTime() + DEFAULT_EVENT_DURATION_MS)
    const now = new Date()

    let rruleLine = ''
    if (recurrence) {
      rruleLine = `RRULE:${toRRule(recurrence)}\r\n`
    }

    let attendeeLines = ''
    if (event.attendees && event.attendees.length > 0) {
      attendeeLines = event.attendees
        .map((a) => {
          const cn = a.name ? `CN=${this.escapeICalValue(a.name)};` : ''
          return `ATTENDEE;${cn}PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${a.email}`
        })
        .join('\r\n')
      attendeeLines += '\r\n'
    }

    const locationLine = event.location
      ? `LOCATION:${this.escapeICalValue(event.location)}\r\n`
      : ''

    const descriptionLine = event.description
      ? `DESCRIPTION:${this.escapeICalValue(event.description)}\r\n`
      : ''

    return `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Scrybe//Calendar//EN\r
CALSCALE:GREGORIAN\r
METHOD:PUBLISH\r
BEGIN:VEVENT\r
UID:${uid}\r
DTSTAMP:${this.toICalDateTime(now)}\r
DTSTART:${this.toICalDateTime(event.startTime)}\r
DTEND:${this.toICalDateTime(endTime)}\r
SUMMARY:${this.escapeICalValue(event.title)}\r
${descriptionLine}${locationLine}${attendeeLines}${rruleLine}END:VEVENT\r
END:VCALENDAR\r
`
  }

  /**
   * Parse VCALENDAR data to CalendarEventInput
   */
  private parseVCalendar(vcal: string): CalendarEventInput | null {
    try {
      const summaryMatch = vcal.match(/SUMMARY:(.+?)(?:\r?\n|$)/i)
      const dtStartMatch = vcal.match(/DTSTART[^:]*:([^\r\n]+)/i)
      const dtEndMatch = vcal.match(/DTEND[^:]*:([^\r\n]+)/i)
      // Use a simpler regex that doesn't require 's' flag for dotall mode
      const descMatch = vcal.match(/DESCRIPTION:([^\r\n]+)/i)
      const locationMatch = vcal.match(/LOCATION:(.+?)(?:\r?\n|$)/i)

      if (!summaryMatch || !dtStartMatch) {
        return null
      }

      const startTime = this.parseICalDateTime(dtStartMatch[1])
      const endTime = dtEndMatch
        ? this.parseICalDateTime(dtEndMatch[1])
        : new Date(startTime.getTime() + DEFAULT_EVENT_DURATION_MS)

      return {
        title: this.unescapeICalValue(summaryMatch[1]),
        description: descMatch ? this.unescapeICalValue(descMatch[1]) : undefined,
        startTime,
        endTime,
        location: locationMatch ? this.unescapeICalValue(locationMatch[1]) : undefined,
      }
    } catch {
      return null
    }
  }

  /**
   * Parse VCALENDAR data to CalendarConflict
   */
  private parseVCalendarForConflict(vcal: string): CalendarConflict | null {
    try {
      const uidMatch = vcal.match(/UID:(.+?)(?:\r?\n|$)/i)
      const summaryMatch = vcal.match(/SUMMARY:(.+?)(?:\r?\n|$)/i)
      const dtStartMatch = vcal.match(/DTSTART[^:]*:([^\r\n]+)/i)
      const dtEndMatch = vcal.match(/DTEND[^:]*:([^\r\n]+)/i)

      if (!uidMatch || !dtStartMatch) {
        return null
      }

      const startTime = this.parseICalDateTime(dtStartMatch[1])
      const endTime = dtEndMatch
        ? this.parseICalDateTime(dtEndMatch[1])
        : new Date(startTime.getTime() + DEFAULT_EVENT_DURATION_MS)

      return {
        eventId: uidMatch[1].trim(),
        title: summaryMatch ? this.unescapeICalValue(summaryMatch[1]) : 'Busy',
        startTime,
        endTime,
      }
    } catch {
      return null
    }
  }

  /**
   * Convert Date to iCal datetime format (YYYYMMDDTHHMMSSZ)
   */
  private toICalDateTime(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  /**
   * Parse iCal datetime to Date
   */
  private parseICalDateTime(icalDate: string): Date {
    // Handle formats: 20240101T120000Z, 20240101T120000, 20240101
    const cleaned = icalDate.trim()

    if (cleaned.includes('T')) {
      // DateTime format
      const formatted = cleaned
        .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z')
      return new Date(formatted)
    } else {
      // Date only format
      const formatted = cleaned.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      return new Date(formatted)
    }
  }

  /**
   * Escape special characters in iCal text values
   */
  private escapeICalValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  /**
   * Unescape iCal text values
   */
  private unescapeICalValue(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim()
  }
}

// Singleton instance
export const appleCalendarAdapter = new AppleCalendarAdapter()
