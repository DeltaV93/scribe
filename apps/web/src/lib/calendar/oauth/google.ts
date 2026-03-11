/**
 * Google Calendar OAuth Service
 *
 * Handles OAuth 2.0 authentication for Google Calendar API v3.
 */

import { CalendarProvider } from '@prisma/client'
import type { CalendarOAuthService, CalendarOAuthTokens } from '../types'

// ============================================
// CONFIGURATION
// ============================================

const GOOGLE_CONFIG = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class GoogleCalendarOAuthService implements CalendarOAuthService {
  readonly provider = CalendarProvider.GOOGLE

  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || ''
    this.clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
    this.redirectUri =
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/calendar/callback/google`

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        '[GoogleCalendar] Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET'
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
      scope: GOOGLE_CONFIG.scopes.join(' '),
      access_type: 'offline', // Required for refresh token
      prompt: 'consent', // Always show consent to get refresh token
      state,
    })

    return `${GOOGLE_CONFIG.authorizationEndpoint}?${params.toString()}`
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
    })

    const response = await fetch(GOOGLE_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `Google token exchange failed: ${error.error_description || error.error}`
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
    })

    const response = await fetch(GOOGLE_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `Google token refresh failed: ${error.error_description || error.error}`
      )
    }

    const data = await response.json()

    return {
      accessToken: data.access_token,
      // Google doesn't always return a new refresh token
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    }
  }
}

// Singleton instance
export const googleCalendarOAuth = new GoogleCalendarOAuthService()
