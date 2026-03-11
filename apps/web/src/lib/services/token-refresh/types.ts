/**
 * Token Refresh Service Types
 *
 * Type definitions for the unified token refresh service.
 */

import type { IntegrationTokenType } from '@prisma/client'

export type { IntegrationTokenType }

/**
 * Result of a token refresh operation
 */
export interface TokenRefreshResult {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
}

/**
 * Interface for token refreshers
 *
 * Each integration type registers a refresher that knows how to
 * refresh tokens for that specific provider.
 */
export interface TokenRefresher {
  /** The integration type this refresher handles */
  type: IntegrationTokenType

  /**
   * Refresh an expired access token using the refresh token
   *
   * @param refreshToken - The encrypted refresh token from the database
   * @returns New tokens with expiration
   * @throws Error if refresh fails (e.g., token revoked)
   */
  refresh(refreshToken: string): Promise<TokenRefreshResult>
}

/**
 * Summary of a token refresh job run
 */
export interface TokenRefreshJobResult {
  /** Number of tokens successfully refreshed */
  refreshed: number
  /** Number of tokens that failed to refresh */
  failed: number
  /** Token IDs that failed (for logging) */
  failedTokenIds: string[]
  /** Total execution time in ms */
  durationMs: number
}

/**
 * Options for the token refresh scheduler
 */
export interface TokenRefreshOptions {
  /** How many minutes before expiry to refresh (default: 15) */
  refreshBeforeExpiryMinutes?: number
  /** Whether to log detailed info (default: false in production) */
  verbose?: boolean
}

/**
 * Token with associated integration info for refresh operations
 */
export interface TokenWithIntegration {
  id: string
  type: IntegrationTokenType
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  meetingIntegrationId: string | null
  calendarIntegrationId: string | null
}
