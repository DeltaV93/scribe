/**
 * Outlook Calendar OAuth Service
 *
 * Handles OAuth 2.0 authentication for Microsoft Graph Calendar API.
 */

import { CalendarProvider } from '@prisma/client'
import type { CalendarOAuthService, CalendarOAuthTokens } from '../types'

// ============================================
// CONFIGURATION
// ============================================

const OUTLOOK_CONFIG = {
  // Use 'common' for multi-tenant apps (personal + work/school accounts)
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  scopes: [
    'offline_access',
    'User.Read',
    'Calendars.ReadWrite',
  ],
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class OutlookCalendarOAuthService implements CalendarOAuthService {
  readonly provider = CalendarProvider.OUTLOOK

  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID || ''
    this.clientSecret = process.env.OUTLOOK_CALENDAR_CLIENT_SECRET || ''
    this.redirectUri =
      process.env.OUTLOOK_CALENDAR_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback/outlook`

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        '[OutlookCalendar] Missing OUTLOOK_CALENDAR_CLIENT_ID or OUTLOOK_CALENDAR_CLIENT_SECRET'
      )
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: OUTLOOK_CONFIG.scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent', // Always show consent to ensure refresh token
      state,
    })

    return `${OUTLOOK_CONFIG.authorizationEndpoint}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<CalendarOAuthTokens> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
      scope: OUTLOOK_CONFIG.scopes.join(' '),
    })

    const response = await fetch(OUTLOOK_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `Outlook token exchange failed: ${error.error_description || error.error}`
      )
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(refreshToken: string): Promise<CalendarOAuthTokens> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      scope: OUTLOOK_CONFIG.scopes.join(' '),
    })

    const response = await fetch(OUTLOOK_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `Outlook token refresh failed: ${error.error_description || error.error}`
      )
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      // Microsoft returns a new refresh token on each refresh
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    }
  }
}

// Singleton instance
export const outlookCalendarOAuth = new OutlookCalendarOAuthService()
