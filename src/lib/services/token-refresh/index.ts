/**
 * Token Refresh Service
 *
 * Unified OAuth token management for all integrations.
 *
 * Features:
 * - Proactive refresh of tokens expiring within 15 minutes
 * - On-demand refresh when API calls fail with 401
 * - Registry pattern for adding new integration types
 * - Automatic notifications on refresh failure
 *
 * Quick Start:
 * ```typescript
 * import {
 *   registerTokenRefresher,
 *   refreshExpiringTokens,
 *   withTokenRefresh,
 * } from '@/lib/services/token-refresh'
 *
 * // Register refreshers for each integration type
 * registerTokenRefresher({
 *   type: 'GOOGLE_CALENDAR',
 *   refresh: async (refreshToken) => {
 *     const response = await googleOAuth.refreshToken(refreshToken)
 *     return {
 *       accessToken: response.access_token,
 *       refreshToken: response.refresh_token,
 *       expiresAt: new Date(Date.now() + response.expires_in * 1000),
 *     }
 *   }
 * })
 *
 * // Wrap API calls with automatic token refresh
 * const result = await withTokenRefresh(tokenId, async (accessToken) => {
 *   return await callExternalApi(accessToken)
 * })
 *
 * // Run scheduled refresh job (call from cron)
 * const stats = await refreshExpiringTokens()
 * ```
 */

// Core service
export {
  registerTokenRefresher,
  getTokenRefresher,
  hasTokenRefresher,
  getRegisteredTokenTypes,
  refreshExpiringTokens,
  refreshTokenById,
  getTokenRefreshStats,
} from './service'

// Middleware for on-demand refresh
export {
  withTokenRefresh,
  getValidAccessToken,
  type WithTokenRefreshOptions,
  type WithTokenRefreshResult,
} from './middleware'

// Types
export type {
  TokenRefresher,
  TokenRefreshResult,
  TokenRefreshJobResult,
  TokenRefreshOptions,
  TokenWithIntegration,
} from './types'

// Refresher registrations
export {
  registerMeetingIntegrationRefreshers,
  registerAllTokenRefreshers,
} from './refreshers'
