/**
 * Token Refresher Registrations
 *
 * Export all refresher registration functions.
 * Import this module during app initialization.
 */

export { registerMeetingIntegrationRefreshers } from './meeting-integrations'

/**
 * Register all token refreshers
 *
 * Call this once during app initialization.
 */
export function registerAllTokenRefreshers(): void {
  // Meeting integrations
  const { registerMeetingIntegrationRefreshers } = require('./meeting-integrations')
  registerMeetingIntegrationRefreshers()

  // Calendar integrations (PX-822)
  const { registerCalendarTokenRefreshers } = require('@/lib/calendar/service')
  registerCalendarTokenRefreshers()
}
