/**
 * Call Scheduling Processor
 *
 * Main entry point for processing scheduling items extracted from calls.
 * Coordinates between the scheduling classifier and tier processors.
 */

import { prisma } from '@/lib/db'
import { CalendarIntegrationStatus } from '@prisma/client'
import type { ExtractedActionItem } from '@/lib/ai/call-action-items'
import type { RecurrenceRule } from '../types'
import type { Tier1ProcessResult } from './tier1-processor'
import type { Tier2ProcessResult } from './tier2-processor'
import { processTier1Item } from './tier1-processor'
import { processTier2Item } from './tier2-processor'
import {
  resolveDateTimeReference,
  isTier1Eligible,
  isVagueTimeReference,
  extractVagueReference,
} from './date-resolver'
import type {
  Tier1Item,
  Tier2Item,
  ActionItemWithScheduling,
  SchedulingClassification,
  RecurrencePattern,
} from './types'

// ============================================
// TYPES
// ============================================

export interface ProcessCallSchedulingResult {
  tier1Results: Array<Tier1ProcessResult & { actionItemDescription: string }>
  tier2Results: Array<Tier2ProcessResult & { actionItemDescription: string }>
  skipped: Array<{ description: string; reason: string }>
}

export interface SchedulingContext {
  callId: string
  userId: string
  orgId: string
  clientId?: string
  clientName: string
  callTimestamp: Date
}

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process scheduling items from extracted action items
 *
 * This is the main entry point called after action items are extracted from a call.
 *
 * Flow:
 * 1. Check if user has active calendar integration
 * 2. Classify each action item for scheduling intent
 * 3. Route Tier 1 items (explicit date/time) to auto-scheduling
 * 4. Route Tier 2 items (vague timing) to pending queue
 * 5. Return results for UI display
 */
export async function processCallScheduling(
  context: SchedulingContext,
  actionItems: ExtractedActionItem[]
): Promise<ProcessCallSchedulingResult> {
  const { callId, userId, orgId, clientId, clientName, callTimestamp } = context

  const tier1Results: ProcessCallSchedulingResult['tier1Results'] = []
  const tier2Results: ProcessCallSchedulingResult['tier2Results'] = []
  const skipped: ProcessCallSchedulingResult['skipped'] = []

  // Step 1: Check if user has active calendar integration
  const hasCalendar = await checkCalendarIntegration(userId)
  if (!hasCalendar) {
    // No calendar connected - skip all scheduling processing
    for (const item of actionItems) {
      if (hasSchedulingIntent(item)) {
        skipped.push({
          description: item.description,
          reason: 'No calendar connected',
        })
      }
    }
    return { tier1Results, tier2Results, skipped }
  }

  // Step 2: Process each action item
  for (const item of actionItems) {
    // Skip items without scheduling intent
    if (!hasSchedulingIntent(item)) {
      continue
    }

    // Classify the scheduling item
    const classification = classifySchedulingItem(item, callTimestamp)

    if (!classification.hasSchedulingIntent) {
      continue
    }

    try {
      if (classification.tier === 'TIER_1' && classification.explicitDateTime) {
        // Tier 1: Explicit date/time - attempt auto-schedule
        const dateTime = new Date(
          `${classification.explicitDateTime.date}T${classification.explicitDateTime.time}:00`
        )

        const recurrence = classification.recurrence?.detected
          ? convertRecurrencePattern(classification.recurrence.pattern)
          : undefined

        const result = await processTier1Item({
          callId,
          userId,
          orgId,
          clientId,
          clientName,
          dateTime,
          recurrence,
          context: item.description,
        })

        tier1Results.push({
          ...result,
          actionItemDescription: item.description,
        })
      } else {
        // Tier 2: Vague timing - create pending item
        const result = await processTier2Item({
          callId,
          userId,
          orgId,
          clientId,
          clientName,
          vagueReference: classification.vagueReference || extractVagueReference(item.description) || 'Follow-up needed',
          hasRecurrence: classification.recurrence?.detected || false,
          recurrenceHint: classification.recurrence?.pattern,
          context: item.description,
        })

        tier2Results.push({
          ...result,
          actionItemDescription: item.description,
        })
      }
    } catch (error) {
      console.error(
        `[CallScheduling] Error processing item "${item.description}":`,
        error
      )
      skipped.push({
        description: item.description,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { tier1Results, tier2Results, skipped }
}

/**
 * Process scheduling from action items with pre-classified scheduling info
 *
 * Use this when action items already have scheduling classification from AI extraction
 */
export async function processClassifiedScheduling(
  context: SchedulingContext,
  actionItems: ActionItemWithScheduling[]
): Promise<ProcessCallSchedulingResult> {
  const { callId, userId, orgId, clientId, clientName } = context

  const tier1Results: ProcessCallSchedulingResult['tier1Results'] = []
  const tier2Results: ProcessCallSchedulingResult['tier2Results'] = []
  const skipped: ProcessCallSchedulingResult['skipped'] = []

  // Check calendar integration
  const hasCalendar = await checkCalendarIntegration(userId)
  if (!hasCalendar) {
    for (const item of actionItems) {
      if (item.scheduling.hasSchedulingIntent) {
        skipped.push({
          description: item.description,
          reason: 'No calendar connected',
        })
      }
    }
    return { tier1Results, tier2Results, skipped }
  }

  // Process items based on pre-classified scheduling
  for (const item of actionItems) {
    const { scheduling } = item

    if (!scheduling.hasSchedulingIntent) {
      continue
    }

    try {
      if (scheduling.tier === 'TIER_1' && scheduling.explicitDateTime) {
        const dateTime = new Date(
          `${scheduling.explicitDateTime.date}T${scheduling.explicitDateTime.time}:00`
        )

        const recurrence = scheduling.recurrence?.detected
          ? convertRecurrencePattern(scheduling.recurrence.pattern)
          : undefined

        const result = await processTier1Item({
          callId,
          userId,
          orgId,
          clientId,
          clientName,
          dateTime,
          recurrence,
          context: item.description,
        })

        tier1Results.push({
          ...result,
          actionItemDescription: item.description,
        })
      } else {
        const result = await processTier2Item({
          callId,
          userId,
          orgId,
          clientId,
          clientName,
          vagueReference: scheduling.vagueReference || 'Follow-up needed',
          hasRecurrence: scheduling.recurrence?.detected || false,
          recurrenceHint: scheduling.recurrence?.pattern,
          context: item.description,
        })

        tier2Results.push({
          ...result,
          actionItemDescription: item.description,
        })
      }
    } catch (error) {
      console.error(
        `[CallScheduling] Error processing classified item "${item.description}":`,
        error
      )
      skipped.push({
        description: item.description,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { tier1Results, tier2Results, skipped }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has an active calendar integration
 */
async function checkCalendarIntegration(userId: string): Promise<boolean> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId },
    select: { status: true },
  })

  return integration?.status === CalendarIntegrationStatus.ACTIVE
}

/**
 * Check if an action item has scheduling intent
 *
 * Basic heuristic check for scheduling-related keywords
 */
function hasSchedulingIntent(item: ExtractedActionItem): boolean {
  const lower = item.description.toLowerCase()

  const schedulingKeywords = [
    'schedule',
    'appointment',
    'meeting',
    'follow-up',
    'follow up',
    'followup',
    'check-in',
    'check in',
    'call back',
    'callback',
    'reconnect',
    'touch base',
    'catch up',
    'meet',
    'see you',
    'let\'s talk',
    'get together',
  ]

  const timeKeywords = [
    'tomorrow',
    'next week',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'morning',
    'afternoon',
    'evening',
    'soon',
    'later',
    'am',
    'pm',
    ':00',
    ':30',
  ]

  const hasSchedulingWord = schedulingKeywords.some((word) =>
    lower.includes(word)
  )
  const hasTimeWord = timeKeywords.some((word) => lower.includes(word))

  return hasSchedulingWord || (hasTimeWord && lower.includes('call'))
}

/**
 * Classify a scheduling item based on its content
 */
function classifySchedulingItem(
  item: ExtractedActionItem,
  anchorDate: Date
): SchedulingClassification {
  const text = item.description

  // Check for vague references first
  if (isVagueTimeReference(text)) {
    return {
      hasSchedulingIntent: true,
      tier: 'TIER_2',
      vagueReference: extractVagueReference(text) || text,
      recurrence: detectRecurrence(text),
    }
  }

  // Try to resolve explicit date/time
  const combinedText = item.dueDate ? `${text} ${item.dueDate}` : text
  const resolution = resolveDateTimeReference({
    dateText: combinedText,
    anchorDate,
  })

  if (isTier1Eligible(resolution) && resolution.date) {
    const date = resolution.date
    return {
      hasSchedulingIntent: true,
      tier: 'TIER_1',
      explicitDateTime: {
        date: formatDate(date),
        time: formatTime(date),
        confidence: resolution.confidence,
      },
      recurrence: detectRecurrence(text),
    }
  }

  // Default to Tier 2 if scheduling intent but can't resolve date/time
  return {
    hasSchedulingIntent: true,
    tier: 'TIER_2',
    vagueReference: item.dueDate || extractVagueReference(text) || text,
    recurrence: detectRecurrence(text),
  }
}

/**
 * Detect recurrence patterns in text
 */
function detectRecurrence(text: string): SchedulingClassification['recurrence'] {
  const lower = text.toLowerCase()

  const recurrencePatterns: Array<{
    pattern: RegExp
    type: RecurrencePattern
  }> = [
    { pattern: /\bevery\s+day\b|\bdaily\b/, type: 'DAILY' },
    { pattern: /\bevery\s+week\b|\bweekly\b/, type: 'WEEKLY' },
    { pattern: /\bevery\s+other\s+week\b|\bbiweekly\b|\bbi-weekly\b/, type: 'BIWEEKLY' },
    { pattern: /\bevery\s+month\b|\bmonthly\b/, type: 'MONTHLY' },
    { pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, type: 'WEEKLY' },
    { pattern: /\bregularly\b|\brecurring\b|\bongoing\b/, type: 'CUSTOM' },
  ]

  for (const { pattern, type } of recurrencePatterns) {
    if (pattern.test(lower)) {
      // Extract days of week if mentioned
      const daysOfWeek = extractDaysOfWeek(lower)

      return {
        detected: true,
        pattern: type,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
        confidence: 0.8,
      }
    }
  }

  return {
    detected: false,
    confidence: 0,
  }
}

/**
 * Extract days of week from text
 */
function extractDaysOfWeek(text: string): string[] {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const found: string[] = []

  for (const day of days) {
    if (text.includes(day)) {
      found.push(day.charAt(0).toUpperCase() + day.slice(1))
    }
  }

  return found
}

/**
 * Convert recurrence pattern to RecurrenceRule
 */
function convertRecurrencePattern(
  pattern?: RecurrencePattern
): RecurrenceRule | undefined {
  if (!pattern || pattern === 'CUSTOM') {
    return undefined
  }

  return {
    frequency: pattern as RecurrenceRule['frequency'],
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format time as HH:mm
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
