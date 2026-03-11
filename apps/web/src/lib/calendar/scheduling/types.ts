/**
 * Scheduling Classification Types
 *
 * Types for classifying and extracting scheduling intent from call action items.
 */

import type { RecurrenceRule } from '../types'

// ============================================
// SCHEDULING TIERS
// ============================================

/**
 * TIER_1: Explicit date AND time mentioned - can be auto-scheduled
 * TIER_2: Vague timing references - requires review
 */
export type SchedulingTier = 'TIER_1' | 'TIER_2'

// ============================================
// RECURRENCE PATTERNS
// ============================================

/**
 * Pattern types detected from natural language
 */
export type RecurrencePattern =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'CUSTOM'

// ============================================
// SCHEDULING CLASSIFICATION
// ============================================

/**
 * Classification result for a single action item's scheduling intent
 */
export interface SchedulingClassification {
  /** Whether the action item involves scheduling a future event */
  hasSchedulingIntent: boolean

  /** Classification tier based on specificity of timing */
  tier: SchedulingTier

  /** Explicit date/time if detected (TIER_1) */
  explicitDateTime?: {
    /** ISO date YYYY-MM-DD */
    date: string
    /** Time in HH:mm (24h format) */
    time: string
    /** Confidence score 0-1 */
    confidence: number
  }

  /** Vague reference text if no explicit date/time (TIER_2) */
  vagueReference?: string

  /** Recurrence information if detected */
  recurrence?: {
    /** Whether recurrence was detected */
    detected: boolean
    /** Pattern type if identifiable */
    pattern?: RecurrencePattern
    /** Days of week for weekly patterns */
    daysOfWeek?: string[]
    /** Confidence score 0-1 */
    confidence: number
  }

  /** Names of participants mentioned for the scheduled event */
  participants?: string[]
}

// ============================================
// EXTRACTED ACTION ITEM WITH SCHEDULING
// ============================================

/**
 * Extended action item with scheduling classification
 */
export interface ActionItemWithScheduling {
  description: string
  assigneeName?: string
  assigneeRole?: 'CASE_MANAGER' | 'CLIENT' | 'OTHER'
  dueDate?: string
  priority?: 1 | 2 | 3
  contextSnippet?: string
  timestampSeconds?: number
  confidence: number

  /** Scheduling classification for this action item */
  scheduling: SchedulingClassification
}

// ============================================
// CLASSIFIER RESULT TYPES
// ============================================

/**
 * Tier 1 item - ready for auto-scheduling
 */
export interface Tier1Item {
  /** Reference to the action item */
  actionItemId: string
  /** Resolved date and time */
  dateTime: Date
  /** Recurrence rule if applicable */
  recurrence?: RecurrenceRule
  /** Client's name from call context */
  clientName: string
  /** Description/context for the calendar event */
  context: string
  /** Original action item description */
  description: string
  /** Participants to invite */
  participants?: string[]
}

/**
 * Tier 2 item - requires human review
 */
export interface Tier2Item {
  /** Reference to the action item */
  actionItemId: string
  /** The vague timing reference from the transcript */
  vagueReference: string
  /** Whether recurrence was mentioned */
  hasRecurrence: boolean
  /** Hint about recurrence pattern if detected */
  recurrenceHint?: string
  /** Client's name from call context */
  clientName: string
  /** Description/context */
  context: string
  /** Original action item description */
  description: string
  /** Participants to invite */
  participants?: string[]
}

/**
 * Result of scheduling classification for all action items from a call
 */
export interface ClassifyResult {
  /** Items with explicit date/time ready for auto-scheduling */
  tier1Items: Tier1Item[]
  /** Items with vague timing that need review */
  tier2Items: Tier2Item[]
}

// ============================================
// DATE RESOLUTION TYPES
// ============================================

/**
 * Result of parsing a date/time reference
 */
export interface DateResolutionResult {
  /** Successfully parsed */
  success: boolean
  /** Resolved date if successful */
  date?: Date
  /** Confidence score 0-1 */
  confidence: number
  /** Whether time was explicitly specified or defaulted */
  timeExplicit: boolean
  /** Error message if parsing failed */
  error?: string
}

/**
 * Input for date resolution
 */
export interface DateResolutionInput {
  /** The date/time text to parse */
  dateText: string
  /** Optional time text if separate from date */
  timeText?: string
  /** Anchor timestamp for relative references */
  anchorDate: Date
}
