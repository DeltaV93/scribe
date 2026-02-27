/**
 * Scheduling Classifier Service
 *
 * Classifies action items from calls into scheduling tiers:
 * - Tier 1: Explicit date/time, ready for auto-scheduling
 * - Tier 2: Vague timing references, requires human review
 */

import { prisma } from '@/lib/db'
import type { RecurrenceRule } from '../types'
import type {
  ActionItemWithScheduling,
  ClassifyResult,
  Tier1Item,
  Tier2Item,
  RecurrencePattern,
} from './types'
import {
  resolveDateTimeReference,
  isTier1Eligible,
  isVagueTimeReference,
  extractVagueReference,
} from './date-resolver'

// ============================================
// RECURRENCE DETECTION
// ============================================

interface RecurrenceInfo {
  detected: boolean
  pattern?: RecurrencePattern
  daysOfWeek?: string[]
  confidence: number
}

/**
 * Detect recurrence pattern from scheduling classification
 */
function detectRecurrence(
  scheduling: ActionItemWithScheduling['scheduling']
): RecurrenceInfo | null {
  if (!scheduling.recurrence || !scheduling.recurrence.detected) {
    return null
  }

  return {
    detected: true,
    pattern: scheduling.recurrence.pattern,
    daysOfWeek: scheduling.recurrence.daysOfWeek,
    confidence: scheduling.recurrence.confidence,
  }
}

/**
 * Convert detected recurrence to RecurrenceRule format
 */
function toRecurrenceRule(info: RecurrenceInfo): RecurrenceRule | undefined {
  if (!info.detected || !info.pattern) {
    return undefined
  }

  // Map pattern to frequency
  const frequencyMap: Record<RecurrencePattern, RecurrenceRule['frequency'] | null> = {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    BIWEEKLY: 'BIWEEKLY',
    MONTHLY: 'MONTHLY',
    CUSTOM: null,
  }

  const frequency = frequencyMap[info.pattern]
  if (!frequency) {
    return undefined
  }

  // Convert day names to numbers
  let daysOfWeek: number[] | undefined
  if (info.daysOfWeek && info.daysOfWeek.length > 0) {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    }
    daysOfWeek = info.daysOfWeek
      .map((d) => dayMap[d.toLowerCase()])
      .filter((n) => n !== undefined)
  }

  return {
    frequency,
    daysOfWeek,
  }
}

// ============================================
// CLASSIFICATION LOGIC
// ============================================

/**
 * Classify scheduling items from extracted action items
 *
 * @param callId - The call ID for context
 * @param actionItems - Action items with scheduling classification from AI
 * @param callTimestamp - Call timestamp for resolving relative dates
 * @returns Classified items split by tier
 */
export async function classifySchedulingItems(
  callId: string,
  actionItems: ActionItemWithScheduling[],
  callTimestamp: Date
): Promise<ClassifyResult> {
  // Get client info for context
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  const clientName = call?.client
    ? `${call.client.firstName} ${call.client.lastName}`.trim()
    : 'Client'

  const tier1Items: Tier1Item[] = []
  const tier2Items: Tier2Item[] = []

  for (const item of actionItems) {
    // Skip items without scheduling intent
    if (!item.scheduling.hasSchedulingIntent) {
      continue
    }

    // Generate a pseudo-ID for the action item (in real usage, these would have DB IDs)
    const actionItemId = `${callId}-${Buffer.from(item.description).toString('base64').slice(0, 12)}`

    // Check if this is a Tier 1 item with explicit date/time
    if (
      item.scheduling.tier === 'TIER_1' &&
      item.scheduling.explicitDateTime
    ) {
      const { date, time, confidence } = item.scheduling.explicitDateTime

      // Resolve the date/time
      const resolution = resolveDateTimeReference({
        dateText: `${date} ${time}`,
        anchorDate: callTimestamp,
      })

      if (resolution.success && resolution.date && isTier1Eligible(resolution)) {
        // Detect recurrence
        const recurrenceInfo = detectRecurrence(item.scheduling)
        const recurrence = recurrenceInfo
          ? toRecurrenceRule(recurrenceInfo)
          : undefined

        tier1Items.push({
          actionItemId,
          dateTime: resolution.date,
          recurrence,
          clientName,
          context: item.contextSnippet || item.description,
          description: item.description,
          participants: item.scheduling.participants,
        })
        continue
      }
    }

    // This is a Tier 2 item (vague reference or low confidence)
    const vagueRef =
      item.scheduling.vagueReference ||
      extractVagueReference(item.description) ||
      item.dueDate ||
      'unspecified timing'

    const recurrenceInfo = detectRecurrence(item.scheduling)

    tier2Items.push({
      actionItemId,
      vagueReference: vagueRef,
      hasRecurrence: recurrenceInfo?.detected || false,
      recurrenceHint: recurrenceInfo?.pattern,
      clientName,
      context: item.contextSnippet || item.description,
      description: item.description,
      participants: item.scheduling.participants,
    })
  }

  return {
    tier1Items,
    tier2Items,
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if an action item description suggests scheduling intent
 *
 * Used as a pre-filter before AI classification
 */
export function hasLikelySchedulingIntent(description: string): boolean {
  const lower = description.toLowerCase()

  const schedulingKeywords = [
    'schedule',
    'meet',
    'meeting',
    'appointment',
    'call',
    'follow up',
    'follow-up',
    'followup',
    'check in',
    'check-in',
    'session',
    'visit',
    'connect',
    'reconnect',
    'talk',
    'discuss',
    'review',
    'catch up',
  ]

  return schedulingKeywords.some((keyword) => lower.includes(keyword))
}

/**
 * Extract participant names from text
 *
 * Looks for patterns like:
 * - "with John"
 * - "and Sarah"
 * - "meet with the team"
 */
export function extractParticipantHints(text: string): string[] {
  const participants: string[] = []

  // Pattern: "with [Name]"
  const withMatch = text.match(/\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)
  if (withMatch) {
    for (const match of withMatch) {
      const name = match.replace(/^with\s+/i, '')
      if (name.toLowerCase() !== 'the' && name.toLowerCase() !== 'a') {
        participants.push(name)
      }
    }
  }

  // Pattern: "and [Name]"
  const andMatch = text.match(/\band\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)
  if (andMatch) {
    for (const match of andMatch) {
      const name = match.replace(/^and\s+/i, '')
      // Filter out common words that might be capitalized
      const skipWords = ['the', 'a', 'an', 'i', 'we', 'they', 'he', 'she']
      if (!skipWords.includes(name.toLowerCase())) {
        participants.push(name)
      }
    }
  }

  return [...new Set(participants)] // Remove duplicates
}
