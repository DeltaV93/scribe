/**
 * Token Refresh Service
 *
 * Unified service for managing OAuth token refresh across all integrations.
 * Supports both scheduled proactive refresh and on-demand refresh.
 *
 * Features:
 * - Proactive refresh of tokens expiring within 15 minutes
 * - On-demand refresh when API calls fail with 401
 * - Registry pattern for adding new integration types
 * - Notification on refresh failure
 *
 * Usage:
 * ```typescript
 * // Register a refresher for a new integration type
 * registerTokenRefresher({
 *   type: 'GOOGLE_CALENDAR',
 *   refresh: async (refreshToken) => {
 *     // Call Google's token endpoint
 *     return { accessToken, refreshToken, expiresAt }
 *   }
 * })
 *
 * // Run the scheduled refresh job
 * const result = await refreshExpiringTokens()
 *
 * // On-demand refresh for a specific token
 * const newToken = await refreshToken(tokenId)
 * ```
 */

import { prisma } from '@/lib/db'
import type { IntegrationTokenType } from '@prisma/client'
// TODO: Add encryption for tokens - currently matches existing MeetingIntegration pattern
// import { encrypt, decrypt } from '@/lib/encryption'
import type {
  TokenRefresher,
  TokenRefreshResult,
  TokenRefreshJobResult,
  TokenRefreshOptions,
  TokenWithIntegration,
} from './types'

// Registry of token refreshers by type
const refresherRegistry = new Map<IntegrationTokenType, TokenRefresher>()

/**
 * Register a token refresher for an integration type
 *
 * Each integration (Zoom, Google Calendar, etc.) registers its own
 * refresh handler that knows how to call the provider's token endpoint.
 */
export function registerTokenRefresher(refresher: TokenRefresher): void {
  if (refresherRegistry.has(refresher.type)) {
    console.warn(
      `[TokenRefresh] Overwriting existing refresher for ${refresher.type}`
    )
  }
  refresherRegistry.set(refresher.type, refresher)
  console.log(`[TokenRefresh] Registered refresher for ${refresher.type}`)
}

/**
 * Get a registered token refresher
 */
export function getTokenRefresher(
  type: IntegrationTokenType
): TokenRefresher | undefined {
  return refresherRegistry.get(type)
}

/**
 * Check if a refresher is registered for a type
 */
export function hasTokenRefresher(type: IntegrationTokenType): boolean {
  return refresherRegistry.has(type)
}

/**
 * Get all registered token types
 */
export function getRegisteredTokenTypes(): IntegrationTokenType[] {
  return Array.from(refresherRegistry.keys())
}

/**
 * Refresh tokens that are expiring soon
 *
 * This is the main scheduled job function. It finds all tokens that will
 * expire within the threshold and attempts to refresh them proactively.
 *
 * @param options - Configuration options
 * @returns Summary of refresh results
 */
export async function refreshExpiringTokens(
  options: TokenRefreshOptions = {}
): Promise<TokenRefreshJobResult> {
  const startTime = Date.now()
  const { refreshBeforeExpiryMinutes = 15, verbose = false } = options

  // Calculate the threshold timestamp
  const expiringThreshold = new Date(
    Date.now() + refreshBeforeExpiryMinutes * 60 * 1000
  )

  if (verbose) {
    console.log(
      `[TokenRefresh] Looking for tokens expiring before ${expiringThreshold.toISOString()}`
    )
  }

  // Find tokens that need refresh
  const tokensToRefresh = await prisma.integrationToken.findMany({
    where: {
      expiresAt: {
        lte: expiringThreshold,
      },
      refreshToken: {
        not: null,
      },
    },
    select: {
      id: true,
      type: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      meetingIntegrationId: true,
      calendarIntegrationId: true,
    },
  })

  if (verbose) {
    console.log(`[TokenRefresh] Found ${tokensToRefresh.length} tokens to refresh`)
  }

  let refreshed = 0
  let failed = 0
  const failedTokenIds: string[] = []

  // Process each token
  for (const token of tokensToRefresh) {
    const result = await refreshSingleToken(token as TokenWithIntegration, verbose)

    if (result.success) {
      refreshed++
    } else {
      failed++
      failedTokenIds.push(token.id)
    }
  }

  const durationMs = Date.now() - startTime

  if (verbose || failed > 0) {
    console.log(
      `[TokenRefresh] Completed: ${refreshed} refreshed, ${failed} failed in ${durationMs}ms`
    )
  }

  return {
    refreshed,
    failed,
    failedTokenIds,
    durationMs,
  }
}

/**
 * Refresh a single token by ID
 *
 * Use this for on-demand refresh when an API call fails with 401.
 *
 * @param tokenId - The token ID to refresh
 * @returns The new token data, or null if refresh failed
 */
export async function refreshTokenById(
  tokenId: string
): Promise<TokenRefreshResult | null> {
  const token = await prisma.integrationToken.findUnique({
    where: { id: tokenId },
    select: {
      id: true,
      type: true,
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      meetingIntegrationId: true,
      calendarIntegrationId: true,
    },
  })

  if (!token || !token.refreshToken) {
    console.error(`[TokenRefresh] Token ${tokenId} not found or has no refresh token`)
    return null
  }

  const result = await refreshSingleToken(token as TokenWithIntegration, true)

  if (!result.success) {
    return null
  }

  // Return decrypted tokens for immediate use
  return {
    accessToken: result.accessToken!,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt!,
  }
}

/**
 * Internal function to refresh a single token
 */
async function refreshSingleToken(
  token: TokenWithIntegration,
  verbose: boolean
): Promise<{
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
}> {
  const refresher = refresherRegistry.get(token.type)

  if (!refresher) {
    console.warn(`[TokenRefresh] No refresher registered for ${token.type}`)
    return { success: false }
  }

  try {
    // TODO: Decrypt the refresh token when encryption is implemented
    // For now, tokens are stored in plain text (matches existing MeetingIntegration pattern)
    const refreshTokenValue = token.refreshToken!

    // Call the provider-specific refresh handler
    const newTokens = await refresher.refresh(refreshTokenValue)

    // TODO: Encrypt the new tokens when encryption is implemented
    const newAccessToken = newTokens.accessToken
    const newRefreshToken = newTokens.refreshToken || token.refreshToken // Keep old refresh token if not rotated

    // Update the token in the database
    await prisma.integrationToken.update({
      where: { id: token.id },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newTokens.expiresAt,
        updatedAt: new Date(),
      },
    })

    // Update the associated integration status to ACTIVE if it was EXPIRED
    if (token.meetingIntegrationId) {
      await prisma.meetingIntegration.update({
        where: { id: token.meetingIntegrationId },
        data: {
          status: 'ACTIVE',
          lastError: null,
          errorCount: 0,
        },
      })
    }

    // TODO: Update CalendarIntegration when that model exists

    if (verbose) {
      console.log(`[TokenRefresh] Successfully refreshed token ${token.id} (${token.type})`)
    }

    return {
      success: true,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: newTokens.expiresAt,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(
      `[TokenRefresh] Failed to refresh token ${token.id} (${token.type}): ${errorMessage}`
    )

    // Mark the integration as errored
    await markIntegrationAsError(token, errorMessage)

    return { success: false }
  }
}

/**
 * Mark an integration as having an error and create a notification
 */
async function markIntegrationAsError(
  token: TokenWithIntegration,
  errorMessage: string
): Promise<void> {
  // Update meeting integration status
  if (token.meetingIntegrationId) {
    const integration = await prisma.meetingIntegration.update({
      where: { id: token.meetingIntegrationId },
      data: {
        status: 'ERROR',
        lastError: `Token refresh failed: ${errorMessage}. Please reconnect.`,
        errorCount: {
          increment: 1,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
          },
        },
      },
    })

    // Get the user who set up the integration
    const meetingIntegration = await prisma.meetingIntegration.findUnique({
      where: { id: token.meetingIntegrationId },
      select: { connectedById: true, orgId: true, platform: true },
    })

    if (meetingIntegration) {
      // Create notification for the user
      await createReconnectNotification(
        meetingIntegration.orgId,
        meetingIntegration.connectedById,
        token.type,
        'meeting'
      )
    }
  }

  // TODO: Handle CalendarIntegration when that model exists
}

/**
 * Create a notification prompting the user to reconnect
 */
async function createReconnectNotification(
  orgId: string,
  userId: string,
  tokenType: IntegrationTokenType,
  integrationType: 'meeting' | 'calendar'
): Promise<void> {
  // Map token type to friendly name
  const typeNames: Record<IntegrationTokenType, string> = {
    ZOOM: 'Zoom',
    TEAMS: 'Microsoft Teams',
    GOOGLE_MEET: 'Google Meet',
    GOOGLE_CALENDAR: 'Google Calendar',
    OUTLOOK_CALENDAR: 'Outlook Calendar',
    APPLE_CALENDAR: 'Apple Calendar',
  }

  const friendlyName = typeNames[tokenType] || tokenType

  const actionUrl =
    integrationType === 'calendar'
      ? '/settings/integrations?tab=calendar'
      : '/settings/integrations?tab=meetings'

  try {
    await prisma.notification.create({
      data: {
        orgId,
        userId,
        type: 'INTEGRATION_ERROR',
        title: `${friendlyName} Disconnected`,
        body: `Your ${friendlyName} connection expired. Please reconnect to continue syncing.`,
        actionUrl,
        metadata: {
          tokenType,
          integrationType,
        },
      },
    })
  } catch (error) {
    // Log but don't throw - notification failure shouldn't stop the process
    console.error('[TokenRefresh] Failed to create reconnect notification:', error)
  }
}

/**
 * Get statistics about token refresh status
 */
export async function getTokenRefreshStats(): Promise<{
  total: number
  byType: Record<string, number>
  expiringSoon: number
  expired: number
}> {
  const now = new Date()
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000)

  const [total, byTypeResults, expiringSoon, expired] = await Promise.all([
    prisma.integrationToken.count(),
    prisma.integrationToken.groupBy({
      by: ['type'],
      _count: true,
    }),
    prisma.integrationToken.count({
      where: {
        expiresAt: {
          gt: now,
          lte: fifteenMinutesFromNow,
        },
      },
    }),
    prisma.integrationToken.count({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    }),
  ])

  const byType: Record<string, number> = {}
  for (const result of byTypeResults) {
    byType[result.type] = result._count
  }

  return {
    total,
    byType,
    expiringSoon,
    expired,
  }
}
