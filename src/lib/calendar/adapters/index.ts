/**
 * Calendar Adapters
 *
 * Provides unified calendar event management across Google, Outlook, and Apple.
 *
 * Usage:
 * ```typescript
 * import { createCalendarAdapter, getCalendarAdapter } from '@/lib/calendar/adapters'
 *
 * // Get adapter for a specific provider
 * const adapter = getCalendarAdapter('GOOGLE')
 *
 * // Create an event
 * const result = await adapter.createEvent(accessToken, {
 *   title: 'Scrybe: Follow-up with John',
 *   description: 'https://app.scrybe.io/calls/123',
 *   startTime: new Date('2024-01-15T10:00:00'),
 *   endTime: new Date('2024-01-15T10:30:00'),
 * })
 *
 * // Check for conflicts
 * const conflicts = await adapter.checkConflicts(
 *   accessToken,
 *   new Date('2024-01-15T10:00:00'),
 *   new Date('2024-01-15T11:00:00')
 * )
 * ```
 */

import { CalendarProvider } from '@prisma/client'
import type { CalendarAdapter } from '../types'
import { googleCalendarAdapter, GoogleCalendarAdapter } from './google'
import { outlookCalendarAdapter, OutlookCalendarAdapter } from './outlook'
import { appleCalendarAdapter, AppleCalendarAdapter } from './apple'

// Re-export adapter classes and instances
export { googleCalendarAdapter, GoogleCalendarAdapter } from './google'
export { outlookCalendarAdapter, OutlookCalendarAdapter } from './outlook'
export { appleCalendarAdapter, AppleCalendarAdapter } from './apple'

// Adapter registry
const adapterRegistry: Record<CalendarProvider, CalendarAdapter> = {
  [CalendarProvider.GOOGLE]: googleCalendarAdapter,
  [CalendarProvider.OUTLOOK]: outlookCalendarAdapter,
  [CalendarProvider.APPLE]: appleCalendarAdapter,
}

/**
 * Get the calendar adapter for a specific provider
 *
 * @param provider - The calendar provider (GOOGLE, OUTLOOK, APPLE)
 * @returns The adapter instance for the provider
 * @throws Error if provider is not supported
 */
export function getCalendarAdapter(provider: CalendarProvider): CalendarAdapter {
  const adapter = adapterRegistry[provider]
  if (!adapter) {
    throw new Error(`Unsupported calendar provider: ${provider}`)
  }
  return adapter
}

/**
 * Create a calendar adapter for a specific provider
 *
 * This is an alias for getCalendarAdapter for semantic clarity when
 * the caller wants to emphasize that they're getting a fresh instance.
 * Note: Currently returns singleton instances, but the API allows for
 * future implementation of per-request instances if needed.
 *
 * @param provider - The calendar provider (GOOGLE, OUTLOOK, APPLE)
 * @returns The adapter instance for the provider
 */
export function createCalendarAdapter(provider: CalendarProvider): CalendarAdapter {
  return getCalendarAdapter(provider)
}

/**
 * Check if a calendar adapter exists for a provider
 *
 * @param provider - The calendar provider
 * @returns True if an adapter exists
 */
export function hasCalendarAdapter(provider: CalendarProvider): boolean {
  return provider in adapterRegistry
}

/**
 * Get all available calendar providers
 *
 * @returns Array of all supported calendar providers
 */
export function getAvailableCalendarProviders(): CalendarProvider[] {
  return Object.keys(adapterRegistry) as CalendarProvider[]
}

/**
 * Helper function to create a Scrybe event title
 *
 * @param clientFirstName - The client's first name
 * @returns Formatted event title
 */
export function createScrybeEventTitle(clientFirstName: string): string {
  return `Scrybe: Follow-up with ${clientFirstName}`
}

/**
 * Helper function to create a Scrybe event description
 *
 * @param callId - The Scrybe call ID
 * @param baseUrl - The application base URL
 * @returns Formatted event description with call link
 */
export function createScrybeEventDescription(
  callId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'https://app.scrybe.io'
): string {
  return `View call details: ${baseUrl}/calls/${callId}`
}

/**
 * Default event duration in milliseconds (30 minutes)
 */
export const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000
