/**
 * Calendar Integration Types
 *
 * Type definitions for calendar OAuth and event management.
 */

import type { CalendarProvider } from '@prisma/client'

// ============================================
// OAUTH TYPES
// ============================================

export interface CalendarOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface CalendarOAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  tokenType?: string
}

export interface CalendarOAuthState {
  userId: string
  orgId: string
  provider: CalendarProvider
  redirectUrl?: string
  timestamp: number
}

// ============================================
// CALENDAR EVENT TYPES
// ============================================

export interface CalendarEventInput {
  title: string
  description?: string
  startTime: Date
  endTime: Date
  attendees?: Array<{ email: string; name?: string }>
  location?: string
  recurrence?: RecurrenceRule
}

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  interval?: number
  daysOfWeek?: number[] // 0=Sunday, 6=Saturday
  until?: Date
  count?: number
}

export interface CalendarConflict {
  eventId: string
  title: string
  startTime: Date
  endTime: Date
}

export interface CreateEventResult {
  success: boolean
  eventId?: string
  error?: string
}

export interface CheckConflictsResult {
  hasConflict: boolean
  conflicts: CalendarConflict[]
}

// ============================================
// CALENDAR ADAPTER INTERFACE
// ============================================

export interface CalendarAdapter {
  provider: CalendarProvider

  /**
   * Create a single calendar event
   */
  createEvent(
    accessToken: string,
    event: CalendarEventInput
  ): Promise<CreateEventResult>

  /**
   * Create a recurring event series
   */
  createRecurringEvent(
    accessToken: string,
    event: CalendarEventInput,
    rule: RecurrenceRule
  ): Promise<CreateEventResult>

  /**
   * Update an existing event
   */
  updateEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CalendarEventInput>
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Delete an event
   */
  deleteEvent(
    accessToken: string,
    eventId: string
  ): Promise<{ success: boolean; error?: string }>

  /**
   * Check for conflicts at a specific time
   */
  checkConflicts(
    accessToken: string,
    startTime: Date,
    endTime: Date
  ): Promise<CheckConflictsResult>

  /**
   * Get user's calendar email/account info
   */
  getUserInfo(accessToken: string): Promise<{ email: string; name?: string }>
}

// ============================================
// CALENDAR OAUTH SERVICE INTERFACE
// ============================================

export interface CalendarOAuthService {
  provider: CalendarProvider

  /**
   * Generate the OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string): Promise<CalendarOAuthTokens>

  /**
   * Refresh an expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<CalendarOAuthTokens>
}

// ============================================
// RRULE HELPERS
// ============================================

/**
 * Convert RecurrenceRule to iCal RRULE string
 */
export function toRRule(rule: RecurrenceRule): string {
  const parts: string[] = []

  // Frequency
  const freqMap: Record<RecurrenceRule['frequency'], string> = {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    BIWEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
  }
  parts.push(`FREQ=${freqMap[rule.frequency]}`)

  // Interval
  if (rule.frequency === 'BIWEEKLY') {
    parts.push('INTERVAL=2')
  } else if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`)
  }

  // Days of week
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    const days = rule.daysOfWeek.map((d) => dayMap[d]).join(',')
    parts.push(`BYDAY=${days}`)
  }

  // Until date
  if (rule.until) {
    const until = rule.until.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    parts.push(`UNTIL=${until}`)
  }

  // Count
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`)
  }

  return parts.join(';')
}

/**
 * Parse iCal RRULE string to RecurrenceRule
 */
export function parseRRule(rrule: string): RecurrenceRule | null {
  try {
    const parts = rrule.split(';')
    const rule: Partial<RecurrenceRule> = {}

    for (const part of parts) {
      const [key, value] = part.split('=')

      switch (key) {
        case 'FREQ':
          if (value === 'DAILY') rule.frequency = 'DAILY'
          else if (value === 'WEEKLY') rule.frequency = 'WEEKLY'
          else if (value === 'MONTHLY') rule.frequency = 'MONTHLY'
          break

        case 'INTERVAL':
          rule.interval = parseInt(value, 10)
          if (rule.frequency === 'WEEKLY' && rule.interval === 2) {
            rule.frequency = 'BIWEEKLY'
            rule.interval = undefined
          }
          break

        case 'BYDAY':
          const dayMap: Record<string, number> = {
            SU: 0,
            MO: 1,
            TU: 2,
            WE: 3,
            TH: 4,
            FR: 5,
            SA: 6,
          }
          rule.daysOfWeek = value.split(',').map((d) => dayMap[d])
          break

        case 'UNTIL':
          rule.until = new Date(
            value.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')
          )
          break

        case 'COUNT':
          rule.count = parseInt(value, 10)
          break
      }
    }

    if (!rule.frequency) return null
    return rule as RecurrenceRule
  } catch {
    return null
  }
}
