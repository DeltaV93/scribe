/**
 * Calendar Integration Service
 *
 * Manages calendar integrations, OAuth flows, and token storage.
 */

import { prisma } from '@/lib/db'
import {
  CalendarProvider,
  CalendarIntegrationStatus,
  IntegrationTokenType,
} from '@prisma/client'
import {
  getCalendarOAuthService,
  isCalendarProviderConfigured,
  getConfiguredCalendarProviders,
} from './oauth'
import { registerTokenRefresher } from '@/lib/services/token-refresh'
import type { CalendarOAuthState, CalendarOAuthTokens } from './types'

// ============================================
// OAUTH STATE MANAGEMENT
// ============================================

const OAUTH_STATE_EXPIRY = 10 * 60 * 1000 // 10 minutes

/**
 * Generate and encode OAuth state parameter
 */
export function generateCalendarOAuthState(
  params: Omit<CalendarOAuthState, 'timestamp'>
): string {
  const state: CalendarOAuthState = {
    ...params,
    timestamp: Date.now(),
  }
  return Buffer.from(JSON.stringify(state)).toString('base64url')
}

/**
 * Decode and validate OAuth state parameter
 */
export function parseCalendarOAuthState(stateParam: string): CalendarOAuthState | null {
  try {
    const decoded = Buffer.from(stateParam, 'base64url').toString()
    const state = JSON.parse(decoded) as CalendarOAuthState

    // Validate timestamp
    if (Date.now() - state.timestamp > OAUTH_STATE_EXPIRY) {
      console.warn('[CalendarOAuth] State parameter expired')
      return null
    }

    return state
  } catch (error) {
    console.error('[CalendarOAuth] Failed to parse state:', error)
    return null
  }
}

// ============================================
// INTEGRATION MANAGEMENT
// ============================================

/**
 * Get a user's calendar integration
 */
export async function getCalendarIntegration(userId: string) {
  return prisma.calendarIntegration.findUnique({
    where: { userId },
    include: {
      integrationToken: true,
    },
  })
}

/**
 * Check if a user has a connected calendar
 */
export async function hasConnectedCalendar(userId: string): Promise<boolean> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId },
    select: { status: true },
  })
  return integration?.status === CalendarIntegrationStatus.ACTIVE
}

/**
 * Get available calendar providers for connection
 */
export function getAvailableProviders(): {
  provider: CalendarProvider
  configured: boolean
}[] {
  return Object.values(CalendarProvider).map((provider) => ({
    provider,
    configured: isCalendarProviderConfigured(provider),
  }))
}

/**
 * Initiate OAuth flow for a calendar provider
 */
export async function initiateCalendarOAuth(
  userId: string,
  orgId: string,
  provider: CalendarProvider,
  redirectUrl?: string
): Promise<string> {
  // Check if provider is configured
  if (!isCalendarProviderConfigured(provider)) {
    throw new Error(`Calendar provider ${provider} is not configured`)
  }

  // Check if user already has a connected calendar
  const existing = await getCalendarIntegration(userId)
  if (existing && existing.status === CalendarIntegrationStatus.ACTIVE) {
    // User already has a connected calendar - they need to disconnect first
    throw new Error(
      `You already have ${existing.provider} calendar connected. Disconnect it first.`
    )
  }

  // Generate state parameter
  const state = generateCalendarOAuthState({
    userId,
    orgId,
    provider,
    redirectUrl,
  })

  // Get authorization URL
  const oauthService = getCalendarOAuthService(provider)
  return oauthService.getAuthorizationUrl(state)
}

/**
 * Map CalendarProvider to IntegrationTokenType
 */
function getTokenType(provider: CalendarProvider): IntegrationTokenType {
  switch (provider) {
    case CalendarProvider.GOOGLE:
      return IntegrationTokenType.GOOGLE_CALENDAR
    case CalendarProvider.OUTLOOK:
      return IntegrationTokenType.OUTLOOK_CALENDAR
    case CalendarProvider.APPLE:
      return IntegrationTokenType.APPLE_CALENDAR
  }
}

/**
 * Complete OAuth flow with authorization code
 */
export async function completeCalendarOAuth(
  code: string,
  state: CalendarOAuthState
): Promise<{
  success: boolean
  provider: CalendarProvider
  email?: string
  error?: string
}> {
  const { userId, orgId, provider } = state

  try {
    // Get OAuth service
    const oauthService = getCalendarOAuthService(provider)

    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForTokens(code)

    // Get user info (email) from the provider
    let externalEmail: string | undefined
    try {
      if (provider === CalendarProvider.GOOGLE) {
        // Fetch Google user info
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        )
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json()
          externalEmail = userInfo.email
        }
      } else if (provider === CalendarProvider.OUTLOOK) {
        // Fetch Microsoft user info
        const userInfoResponse = await fetch(
          'https://graph.microsoft.com/v1.0/me',
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        )
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json()
          externalEmail = userInfo.mail || userInfo.userPrincipalName
        }
      }
    } catch (error) {
      console.warn('[CalendarOAuth] Failed to get user email:', error)
    }

    // Create or update integration in a transaction
    await prisma.$transaction(async (tx) => {
      // Upsert the calendar integration
      const integration = await tx.calendarIntegration.upsert({
        where: { userId },
        create: {
          userId,
          orgId,
          provider,
          externalEmail,
          status: CalendarIntegrationStatus.ACTIVE,
          connectedAt: new Date(),
        },
        update: {
          provider,
          externalEmail,
          status: CalendarIntegrationStatus.ACTIVE,
          lastError: null,
          connectedAt: new Date(),
        },
      })

      // Delete any existing token for this integration
      await tx.integrationToken.deleteMany({
        where: { calendarIntegrationId: integration.id },
      })

      // Create the integration token
      await tx.integrationToken.create({
        data: {
          type: getTokenType(provider),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          calendarIntegrationId: integration.id,
        },
      })
    })

    return {
      success: true,
      provider,
      email: externalEmail,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CalendarOAuth] Failed to complete OAuth:', error)

    // Update integration status to error
    await prisma.calendarIntegration.upsert({
      where: { userId },
      create: {
        userId,
        orgId,
        provider,
        status: CalendarIntegrationStatus.ERROR,
        lastError: errorMessage,
      },
      update: {
        status: CalendarIntegrationStatus.ERROR,
        lastError: errorMessage,
      },
    })

    return {
      success: false,
      provider,
      error: errorMessage,
    }
  }
}

/**
 * Disconnect a calendar integration
 */
export async function disconnectCalendar(userId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const integration = await getCalendarIntegration(userId)

    if (!integration) {
      return { success: false, error: 'No calendar integration found' }
    }

    // Update status to disconnected and remove token
    await prisma.$transaction(async (tx) => {
      // Delete the token
      if (integration.integrationToken) {
        await tx.integrationToken.delete({
          where: { id: integration.integrationToken.id },
        })
      }

      // Update integration status
      await tx.calendarIntegration.update({
        where: { id: integration.id },
        data: {
          status: CalendarIntegrationStatus.DISCONNECTED,
          lastError: null,
        },
      })
    })

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Calendar] Failed to disconnect:', error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Update calendar integration settings
 */
export async function updateCalendarSettings(
  userId: string,
  settings: { clientAutoInvite?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.calendarIntegration.update({
      where: { userId },
      data: settings,
    })
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Get access token for a user's calendar integration
 *
 * Returns the decrypted access token for making API calls.
 * Token refresh is handled by the token refresh service.
 */
export async function getCalendarAccessToken(
  userId: string
): Promise<string | null> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId },
    include: {
      integrationToken: true,
    },
  })

  if (
    !integration ||
    integration.status !== CalendarIntegrationStatus.ACTIVE ||
    !integration.integrationToken
  ) {
    return null
  }

  // TODO: Add decryption when token encryption is implemented
  return integration.integrationToken.accessToken
}

// ============================================
// TOKEN REFRESHER REGISTRATION
// ============================================

/**
 * Register calendar token refreshers with the token refresh service
 */
export function registerCalendarTokenRefreshers(): void {
  const configuredProviders = getConfiguredCalendarProviders()

  for (const provider of configuredProviders) {
    const oauthService = getCalendarOAuthService(provider)
    const tokenType = getTokenType(provider)

    registerTokenRefresher({
      type: tokenType,
      refresh: async (refreshToken: string) => {
        const tokens = await oauthService.refreshAccessToken(refreshToken)
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt || new Date(Date.now() + 3600 * 1000),
        }
      },
    })
  }

  console.log(
    `[Calendar] Registered token refreshers for: ${configuredProviders.join(', ')}`
  )
}
