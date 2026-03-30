/**
 * Integration Sensitivity Check (PX-1002)
 *
 * Validates that outputs can be safely pushed to external integrations.
 * Blocks RESTRICTED and REDACTED content from being sent externally.
 *
 * Security Gate:
 * - Only STANDARD tier outputs can be pushed to external integrations
 * - RESTRICTED content stays within Inkra (RBAC-limited access)
 * - REDACTED content is permanently removed and never leaves the system
 */

import { SensitivityTier, FlagReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

// ============================================
// Types
// ============================================

export interface SensitivityCheckResult {
  /** Whether the output can be pushed to external integrations */
  canPush: boolean;
  /** The sensitivity tier of the content */
  tier: SensitivityTier | null;
  /** Reason why push is blocked (if blocked) */
  reason?: string;
  /** Whether there are pending sensitivity reviews */
  pendingReview?: boolean;
}

interface FlaggedSegmentInfo {
  id: string;
  suggestedTier: SensitivityTier;
  finalTier: SensitivityTier | null;
  status: FlagReviewStatus;
}

// ============================================
// Sensitivity Tier Descriptions
// ============================================

const TIER_DESCRIPTIONS: Record<SensitivityTier, string> = {
  STANDARD: "Normal content, safe for external sharing",
  RESTRICTED: "RBAC-limited content, cannot be sent to external systems",
  REDACTED: "Sensitive content that has been permanently removed",
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check flagged segments for any that would block external push
 */
function checkFlaggedSegments(
  segments: FlaggedSegmentInfo[]
): { blocked: boolean; tier?: SensitivityTier } {
  // Find any segment that is not STANDARD
  const blockedSegment = segments.find((segment) => {
    // Use final tier if reviewed, otherwise use suggested tier
    const effectiveTier = segment.finalTier ?? segment.suggestedTier;
    return effectiveTier !== SensitivityTier.STANDARD;
  });

  if (blockedSegment) {
    const effectiveTier = blockedSegment.finalTier ?? blockedSegment.suggestedTier;
    return { blocked: true, tier: effectiveTier };
  }

  // Check for pending reviews that haven't been resolved
  const pendingSegment = segments.find(
    (segment) => segment.status === FlagReviewStatus.PENDING
  );

  if (pendingSegment) {
    // If there's a pending review with suggested RESTRICTED/REDACTED, block
    if (pendingSegment.suggestedTier !== SensitivityTier.STANDARD) {
      return { blocked: true, tier: pendingSegment.suggestedTier };
    }
  }

  return { blocked: false };
}

// ============================================
// Main Check Function
// ============================================

/**
 * Check if an output can be safely pushed to external integrations
 *
 * Rules:
 * 1. Only STANDARD tier outputs can be pushed
 * 2. If any flagged segment in the source is RESTRICTED/REDACTED, block
 * 3. If there are pending reviews with non-STANDARD suggestions, block
 */
export async function checkOutputSensitivity(
  outputId: string
): Promise<SensitivityCheckResult> {
  // Get the output with its conversation and flagged segments
  const output = await prisma.draftedOutput.findUnique({
    where: { id: outputId },
    include: {
      conversation: {
        include: {
          flaggedSegments: {
            select: {
              id: true,
              suggestedTier: true,
              finalTier: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!output) {
    return {
      canPush: false,
      tier: null,
      reason: "Output not found",
    };
  }

  const conversation = output.conversation;

  // Check 1: Conversation-level sensitivity tier
  if (conversation.sensitivityTier !== SensitivityTier.STANDARD) {
    return {
      canPush: false,
      tier: conversation.sensitivityTier,
      reason: `This content is ${conversation.sensitivityTier.toLowerCase()} and cannot be sent to external integrations. ${TIER_DESCRIPTIONS[conversation.sensitivityTier]}`,
    };
  }

  // Check 2: Check flagged segments for any RESTRICTED/REDACTED content
  const segmentCheck = checkFlaggedSegments(conversation.flaggedSegments);
  if (segmentCheck.blocked && segmentCheck.tier) {
    return {
      canPush: false,
      tier: segmentCheck.tier,
      reason: `This conversation contains ${segmentCheck.tier.toLowerCase()} content and cannot be sent to external integrations`,
      pendingReview: conversation.flaggedSegments.some(
        (s) => s.status === FlagReviewStatus.PENDING
      ),
    };
  }

  // All checks passed
  return {
    canPush: true,
    tier: SensitivityTier.STANDARD,
  };
}

/**
 * Check if a conversation can have outputs pushed to external integrations
 *
 * Bulk check for all outputs in a conversation.
 */
export async function checkConversationSensitivity(
  conversationId: string
): Promise<SensitivityCheckResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      flaggedSegments: {
        select: {
          id: true,
          suggestedTier: true,
          finalTier: true,
          status: true,
        },
      },
    },
  });

  if (!conversation) {
    return {
      canPush: false,
      tier: null,
      reason: "Conversation not found",
    };
  }

  // Check 1: Conversation-level tier
  if (conversation.sensitivityTier !== SensitivityTier.STANDARD) {
    return {
      canPush: false,
      tier: conversation.sensitivityTier,
      reason: `Conversation is ${conversation.sensitivityTier.toLowerCase()}`,
    };
  }

  // Check 2: Flagged segments
  const segmentCheck = checkFlaggedSegments(conversation.flaggedSegments);
  if (segmentCheck.blocked && segmentCheck.tier) {
    return {
      canPush: false,
      tier: segmentCheck.tier,
      reason: `Conversation contains ${segmentCheck.tier.toLowerCase()} content`,
      pendingReview: conversation.flaggedSegments.some(
        (s) => s.status === FlagReviewStatus.PENDING
      ),
    };
  }

  return {
    canPush: true,
    tier: SensitivityTier.STANDARD,
  };
}

/**
 * Get outputs that can be pushed for a conversation
 *
 * Returns only outputs that pass sensitivity checks.
 */
export async function getPushableOutputs(conversationId: string) {
  // First check conversation-level sensitivity
  const conversationCheck = await checkConversationSensitivity(conversationId);

  if (!conversationCheck.canPush) {
    return {
      canPush: false,
      reason: conversationCheck.reason,
      outputs: [],
    };
  }

  // Get all approved/pending outputs
  const outputs = await prisma.draftedOutput.findMany({
    where: {
      conversationId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: {
      id: true,
      title: true,
      outputType: true,
      status: true,
      destinationPlatform: true,
    },
  });

  return {
    canPush: true,
    outputs,
  };
}

/**
 * Check if a specific output type can be pushed to a specific platform
 *
 * Some output types are only compatible with certain platforms.
 */
export function isOutputTypeCompatibleWithPlatform(
  outputType: string,
  platform: string
): boolean {
  const compatibilityMap: Record<string, string[]> = {
    ACTION_ITEM: ["LINEAR", "JIRA", "NOTION", "ASANA", "MONDAY"],
    MEETING_NOTES: ["NOTION", "GOOGLE_DOCS", "CONFLUENCE"],
    MESSAGE: ["SLACK", "TEAMS"],
    EMAIL_DRAFT: ["GMAIL", "OUTLOOK"],
    CALENDAR_EVENT: ["GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"],
  };

  const compatiblePlatforms = compatibilityMap[outputType];
  if (!compatiblePlatforms) {
    return false;
  }

  return compatiblePlatforms.includes(platform);
}
