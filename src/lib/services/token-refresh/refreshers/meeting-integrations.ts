/**
 * Meeting Integration Token Refreshers
 *
 * Registers token refreshers for Zoom, Teams, and Google Meet
 * with the unified token refresh service.
 */

import { registerTokenRefresher } from '../service'
import { zoomService } from '../../meetings/integrations/zoom'
import { teamsService } from '../../meetings/integrations/teams'
import { googleMeetService } from '../../meetings/integrations/google-meet'

/**
 * Register all meeting integration token refreshers
 *
 * Call this during app initialization to enable automatic
 * token refresh for meeting integrations.
 */
export function registerMeetingIntegrationRefreshers(): void {
  // Zoom
  registerTokenRefresher({
    type: 'ZOOM',
    refresh: async (refreshToken: string) => {
      const tokens = await zoomService.refreshAccessToken(refreshToken)
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt || new Date(Date.now() + 3600 * 1000),
      }
    },
  })

  // Microsoft Teams
  registerTokenRefresher({
    type: 'TEAMS',
    refresh: async (refreshToken: string) => {
      const tokens = await teamsService.refreshAccessToken(refreshToken)
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt || new Date(Date.now() + 3600 * 1000),
      }
    },
  })

  // Google Meet
  registerTokenRefresher({
    type: 'GOOGLE_MEET',
    refresh: async (refreshToken: string) => {
      const tokens = await googleMeetService.refreshAccessToken(refreshToken)
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt || new Date(Date.now() + 3600 * 1000),
      }
    },
  })

  console.log('[TokenRefresh] Registered meeting integration refreshers: ZOOM, TEAMS, GOOGLE_MEET')
}
