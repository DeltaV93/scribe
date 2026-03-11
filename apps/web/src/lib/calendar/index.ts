/**
 * Calendar Integration Module
 *
 * Provides calendar OAuth, event management, and scheduling features.
 *
 * Quick Start:
 * ```typescript
 * import {
 *   initiateCalendarOAuth,
 *   getCalendarIntegration,
 *   registerCalendarTokenRefreshers,
 * } from '@/lib/calendar'
 *
 * // Register refreshers on app startup
 * registerCalendarTokenRefreshers()
 *
 * // Get user's calendar integration
 * const integration = await getCalendarIntegration(userId)
 *
 * // Start OAuth flow
 * const authUrl = await initiateCalendarOAuth(userId, orgId, 'GOOGLE')
 * ```
 */

// Types
export * from './types'

// OAuth services
export {
  googleCalendarOAuth,
  outlookCalendarOAuth,
  appleCalendarOAuth,
  getCalendarOAuthService,
  isCalendarProviderConfigured,
  getConfiguredCalendarProviders,
} from './oauth'

// Integration service
export {
  // OAuth state
  generateCalendarOAuthState,
  parseCalendarOAuthState,
  // Integration management
  getCalendarIntegration,
  hasConnectedCalendar,
  getAvailableProviders,
  initiateCalendarOAuth,
  completeCalendarOAuth,
  disconnectCalendar,
  updateCalendarSettings,
  getCalendarAccessToken,
  // Token refresh registration
  registerCalendarTokenRefreshers,
} from './service'

// Scheduling classification
export {
  // Types
  type SchedulingTier,
  type RecurrencePattern,
  type SchedulingClassification,
  type ActionItemWithScheduling,
  type Tier1Item,
  type Tier2Item,
  type ClassifyResult,
  // Classifier
  classifySchedulingItems,
  hasLikelySchedulingIntent,
  extractParticipantHints,
  // Date resolver
  resolveDateTimeReference,
  isTier1Eligible,
  isVagueTimeReference,
} from './scheduling'

// Calendar adapters
export {
  // Adapter factory functions
  getCalendarAdapter,
  createCalendarAdapter,
  hasCalendarAdapter,
  getAvailableCalendarProviders,
  // Adapter instances
  googleCalendarAdapter,
  outlookCalendarAdapter,
  appleCalendarAdapter,
  // Helper functions
  createScrybeEventTitle,
  createScrybeEventDescription,
  DEFAULT_EVENT_DURATION_MS,
} from './adapters'
