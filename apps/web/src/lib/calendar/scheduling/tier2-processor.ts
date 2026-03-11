/**
 * Tier 2 Scheduling Processor
 *
 * Handles scheduling items with vague timing references.
 * Creates pending items for user review and sends notifications.
 */

import { prisma } from '@/lib/db'
import {
  PendingSchedulingTier,
  PendingSchedulingStatus,
} from '@prisma/client'
import { createNotification } from '@/lib/services/notifications'

// ============================================
// TYPES
// ============================================

export interface Tier2ProcessInput {
  callId: string
  userId: string
  orgId: string
  clientId?: string
  clientName: string
  vagueReference: string
  hasRecurrence: boolean
  recurrenceHint?: string
  context: string
  actionItemId?: string
}

export interface Tier2ProcessResult {
  pendingItemId: string
  notificationId?: string
}

// ============================================
// CONSTANTS
// ============================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.scrybe.io'

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process a Tier 2 scheduling item (vague timing)
 *
 * Flow:
 * 1. Create PendingSchedulingItem with TIER_2_VAGUE
 * 2. Create in-app notification for user
 * 3. Return the pending item ID
 */
export async function processTier2Item(
  input: Tier2ProcessInput
): Promise<Tier2ProcessResult> {
  const {
    callId,
    userId,
    orgId,
    clientId,
    clientName,
    vagueReference,
    hasRecurrence,
    recurrenceHint,
    context,
  } = input

  try {
    // Step 1: Create PendingSchedulingItem
    const pendingItem = await prisma.pendingSchedulingItem.create({
      data: {
        callId,
        userId,
        orgId,
        clientId,
        clientName: extractFirstName(clientName),
        extractedContext: context,
        extractedDateHint: vagueReference, // Store the vague reference as the hint
        hasRecurrence,
        recurrencePattern: recurrenceHint,
        tier: PendingSchedulingTier.TIER_2_VAGUE,
        status: PendingSchedulingStatus.PENDING,
      },
    })

    // Step 2: Create in-app notification
    const notification = await createNotification({
      orgId,
      userId,
      type: 'CALENDAR_PENDING_REVIEW',
      title: 'Scheduling Item Needs Review',
      body: `A follow-up with ${extractFirstName(clientName)} needs to be scheduled. "${vagueReference}"`,
      actionUrl: `${APP_URL}/calls/${callId}/review?tab=scheduling&pendingId=${pendingItem.id}`,
      metadata: {
        pendingItemId: pendingItem.id,
        callId,
        clientId,
        clientName: extractFirstName(clientName),
        vagueReference,
        tier: 'TIER_2_VAGUE',
      },
    })

    return {
      pendingItemId: pendingItem.id,
      notificationId: notification.id,
    }
  } catch (error) {
    console.error('[Tier2Processor] Error processing item:', error)
    throw error
  }
}

/**
 * Create multiple Tier 2 items in batch
 *
 * Useful when processing multiple vague scheduling references from a single call
 */
export async function processTier2Batch(
  items: Tier2ProcessInput[]
): Promise<Tier2ProcessResult[]> {
  const results: Tier2ProcessResult[] = []

  for (const item of items) {
    const result = await processTier2Item(item)
    results.push(result)
  }

  return results
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract first name from full client name
 */
function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[0] || fullName
}
