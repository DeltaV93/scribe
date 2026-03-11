/**
 * Calendar OAuth Services
 *
 * Exports OAuth services for all calendar providers.
 */

import { CalendarProvider } from '@prisma/client'
import type { CalendarOAuthService } from '../types'
import { googleCalendarOAuth, GoogleCalendarOAuthService } from './google'
import { outlookCalendarOAuth, OutlookCalendarOAuthService } from './outlook'
import { appleCalendarOAuth, AppleCalendarOAuthService } from './apple'

// Re-export services
export { googleCalendarOAuth, GoogleCalendarOAuthService } from './google'
export { outlookCalendarOAuth, OutlookCalendarOAuthService } from './outlook'
export { appleCalendarOAuth, AppleCalendarOAuthService } from './apple'

// Service registry
const oauthServices: Record<CalendarProvider, CalendarOAuthService> = {
  [CalendarProvider.GOOGLE]: googleCalendarOAuth,
  [CalendarProvider.OUTLOOK]: outlookCalendarOAuth,
  [CalendarProvider.APPLE]: appleCalendarOAuth,
}

/**
 * Get the OAuth service for a calendar provider
 */
export function getCalendarOAuthService(
  provider: CalendarProvider
): CalendarOAuthService {
  const service = oauthServices[provider]
  if (!service) {
    throw new Error(`Unsupported calendar provider: ${provider}`)
  }
  return service
}

/**
 * Check if a calendar provider is configured (has required env vars)
 */
export function isCalendarProviderConfigured(provider: CalendarProvider): boolean {
  switch (provider) {
    case CalendarProvider.GOOGLE:
      return !!(
        process.env.GOOGLE_CALENDAR_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET
      )
    case CalendarProvider.OUTLOOK:
      return !!(
        process.env.OUTLOOK_CALENDAR_CLIENT_ID &&
        process.env.OUTLOOK_CALENDAR_CLIENT_SECRET
      )
    case CalendarProvider.APPLE:
      return !!(
        process.env.APPLE_CALENDAR_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY
      )
    default:
      return false
  }
}

/**
 * Get list of configured calendar providers
 */
export function getConfiguredCalendarProviders(): CalendarProvider[] {
  return Object.values(CalendarProvider).filter(isCalendarProviderConfigured)
}
