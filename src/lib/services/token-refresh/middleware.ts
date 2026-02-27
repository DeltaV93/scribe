/**
 * Token Refresh Middleware
 *
 * Provides on-demand token refresh when API calls fail with 401.
 * Wraps external API calls with automatic token refresh and retry.
 *
 * Usage:
 * ```typescript
 * const result = await withTokenRefresh(
 *   tokenId,
 *   async (accessToken) => {
 *     // Make API call with accessToken
 *     return await fetch(url, {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *   }
 * )
 * ```
 */

import { prisma } from '@/lib/db'
// TODO: Add decryption when token encryption is implemented
// import { decrypt } from '@/lib/encryption'
import { refreshTokenById } from './service'

export interface WithTokenRefreshOptions {
  /** Maximum number of refresh attempts (default: 1) */
  maxRefreshAttempts?: number
}

export interface WithTokenRefreshResult<T> {
  success: boolean
  data?: T
  error?: string
  tokenRefreshed?: boolean
}

/**
 * Execute a function with automatic token refresh on 401
 *
 * @param tokenId - The IntegrationToken ID
 * @param fn - Function that receives the decrypted access token
 * @param options - Configuration options
 * @returns Result of the function call
 */
export async function withTokenRefresh<T>(
  tokenId: string,
  fn: (accessToken: string) => Promise<T>,
  options: WithTokenRefreshOptions = {}
): Promise<WithTokenRefreshResult<T>> {
  const { maxRefreshAttempts = 1 } = options

  // Get the current token
  const token = await prisma.integrationToken.findUnique({
    where: { id: tokenId },
    select: {
      accessToken: true,
      expiresAt: true,
    },
  })

  if (!token) {
    return {
      success: false,
      error: 'Token not found',
    }
  }

  // TODO: Decrypt the access token when encryption is implemented
  let accessToken = token.accessToken
  let tokenRefreshed = false
  let lastError: string | undefined

  // Check if token is already expired - proactively refresh
  if (token.expiresAt && token.expiresAt <= new Date()) {
    const refreshResult = await refreshTokenById(tokenId)
    if (refreshResult) {
      accessToken = refreshResult.accessToken
      tokenRefreshed = true
    } else {
      return {
        success: false,
        error: 'Token expired and refresh failed',
        tokenRefreshed: false,
      }
    }
  }

  // Try the operation
  for (let attempt = 0; attempt <= maxRefreshAttempts; attempt++) {
    try {
      const result = await fn(accessToken)
      return {
        success: true,
        data: result,
        tokenRefreshed,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's a 401 error (token expired/invalid)
      const is401 = isUnauthorizedError(error)

      if (is401 && attempt < maxRefreshAttempts) {
        // Try to refresh the token
        const refreshResult = await refreshTokenById(tokenId)

        if (refreshResult) {
          accessToken = refreshResult.accessToken
          tokenRefreshed = true
          continue // Retry with new token
        } else {
          return {
            success: false,
            error: 'Token refresh failed. Please reconnect the integration.',
            tokenRefreshed: false,
          }
        }
      }

      // Not a 401 or out of retries
      break
    }
  }

  return {
    success: false,
    error: lastError,
    tokenRefreshed,
  }
}

/**
 * Check if an error is a 401 Unauthorized error
 */
function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check message for common patterns
    const message = error.message.toLowerCase()
    if (
      message.includes('401') ||
      message.includes('unauthorized') ||
      message.includes('token expired') ||
      message.includes('invalid_token') ||
      message.includes('token_expired')
    ) {
      return true
    }
  }

  // Check if it's a Response-like object with status
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status: number }).status === 401
  ) {
    return true
  }

  return false
}

/**
 * Get a valid access token, refreshing if necessary
 *
 * Simpler helper when you just need the token, not to wrap a function.
 *
 * @param tokenId - The IntegrationToken ID
 * @returns Decrypted access token, or null if unavailable
 */
export async function getValidAccessToken(
  tokenId: string
): Promise<string | null> {
  const token = await prisma.integrationToken.findUnique({
    where: { id: tokenId },
    select: {
      accessToken: true,
      expiresAt: true,
      refreshToken: true,
    },
  })

  if (!token) {
    return null
  }

  // If token is not expired (with 5 min buffer), return it
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (!token.expiresAt || token.expiresAt > fiveMinutesFromNow) {
    // TODO: Decrypt when encryption is implemented
    return token.accessToken
  }

  // Token is expiring soon - try to refresh
  if (token.refreshToken) {
    const refreshResult = await refreshTokenById(tokenId)
    if (refreshResult) {
      return refreshResult.accessToken
    }
  }

  // Can't refresh, return current token (might still work)
  // TODO: Decrypt when encryption is implemented
  return token.accessToken
}
