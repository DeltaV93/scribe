/**
 * Scheduling Module
 *
 * Provides AI-powered scheduling classification for call action items.
 *
 * Features:
 * - Classify action items into scheduling tiers (TIER_1 = auto-schedule, TIER_2 = review)
 * - Parse relative and absolute date/time references
 * - Detect recurrence patterns
 * - Extract participant names
 *
 * Usage:
 * ```typescript
 * import {
 *   classifySchedulingItems,
 *   resolveDateTimeReference,
 * } from '@/lib/calendar/scheduling'
 *
 * // Classify action items from a call
 * const result = await classifySchedulingItems(callId, actionItems, callTimestamp)
 *
 * // result.tier1Items - Ready for auto-scheduling
 * // result.tier2Items - Require human review
 * ```
 */

// Types
export type {
  SchedulingTier,
  RecurrencePattern,
  SchedulingClassification,
  ActionItemWithScheduling,
  Tier1Item,
  Tier2Item,
  ClassifyResult,
  DateResolutionResult,
  DateResolutionInput,
} from './types'

// Classifier service
export {
  classifySchedulingItems,
  hasLikelySchedulingIntent,
  extractParticipantHints,
} from './classifier'

// Date resolver
export {
  parseTime,
  parseDate,
  resolveDateTimeReference,
  isTier1Eligible,
  isVagueTimeReference,
  extractVagueReference,
} from './date-resolver'

// Tier processors
export {
  processTier1Item,
  type Tier1ProcessInput,
  type Tier1ProcessResult,
} from './tier1-processor'

export {
  processTier2Item,
  processTier2Batch,
  type Tier2ProcessInput,
  type Tier2ProcessResult,
} from './tier2-processor'

// Main entry point
export {
  processCallScheduling,
  processClassifiedScheduling,
  type ProcessCallSchedulingResult,
  type SchedulingContext,
} from './process-call-scheduling'

// Notification helpers
export {
  createCalendarEventNotification,
  createPendingReviewNotification,
  createIntegrationErrorNotification,
  createBatchEventNotifications,
  createConflictNotification,
} from './notifications'
