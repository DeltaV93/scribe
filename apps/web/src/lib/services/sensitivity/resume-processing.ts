/**
 * Resume call processing after sensitivity review.
 * PX-878: Tiered Content Classifier
 *
 * When a call is blocked for sensitivity review, this module handles
 * resuming the processing pipeline after human review is complete.
 */

import { prisma } from "@/lib/db";
import { ProcessingStatus } from "@prisma/client";

/**
 * Resume call processing after sensitivity review.
 *
 * This function:
 * 1. Marks the sensitivity review as complete
 * 2. Updates the call record
 * 3. Triggers the remaining processing steps
 *
 * @param callId - The call ID to resume processing for
 * @param reviewedById - User ID who completed the review
 */
export async function resumeAfterSensitivityReview(
  callId: string,
  reviewedById: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        pendingSensitivityReview: true,
        sensitivityReviewed: true,
        aiProcessingStatus: true,
      },
    });

    if (!call) {
      return { success: false, error: "Call not found" };
    }

    if (!call.pendingSensitivityReview) {
      return { success: false, error: "Call is not pending sensitivity review" };
    }

    // Mark review as complete
    await prisma.call.update({
      where: { id: callId },
      data: {
        pendingSensitivityReview: false,
        sensitivityReviewed: true,
        sensitivityReviewedAt: new Date(),
        sensitivityReviewedById: reviewedById,
      },
    });

    console.log(
      `[SensitivityResume] Review completed for call ${callId} by ${reviewedById}`
    );

    // Continue processing
    // We use a dynamic import to avoid circular dependencies
    const { continueCallProcessingAfterReview } = await import(
      "./continue-processing"
    );

    const result = await continueCallProcessingAfterReview(callId);

    return result;
  } catch (error) {
    console.error(`[SensitivityResume] Error resuming call ${callId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a call is blocked for sensitivity review.
 */
export async function isBlockedForSensitivityReview(
  callId: string
): Promise<boolean> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { pendingSensitivityReview: true },
  });

  return call?.pendingSensitivityReview ?? false;
}

/**
 * Get all calls pending sensitivity review for an organization.
 */
export async function getCallsPendingReview(
  orgId: string,
  limit = 50
): Promise<
  {
    id: string;
    clientName: string;
    startedAt: Date;
    sensitivityTier: string | null;
    sensitivityConfidence: number | null;
  }[]
> {
  const calls = await prisma.call.findMany({
    where: {
      client: { orgId },
      pendingSensitivityReview: true,
    },
    select: {
      id: true,
      startedAt: true,
      sensitivityTier: true,
      sensitivityConfidence: true,
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return calls.map((call) => ({
    id: call.id,
    clientName: `${call.client.firstName} ${call.client.lastName}`,
    startedAt: call.startedAt,
    sensitivityTier: call.sensitivityTier,
    sensitivityConfidence: call.sensitivityConfidence,
  }));
}

/**
 * Mark a call's sensitivity review as timed out.
 * Used by background job for stale reviews.
 */
export async function markReviewTimedOut(
  callId: string,
  reason = "Review timeout"
): Promise<void> {
  await prisma.call.update({
    where: { id: callId },
    data: {
      pendingSensitivityReview: false,
      sensitivityReviewed: false,
      aiProcessingStatus: ProcessingStatus.FAILED,
      aiProcessingError: reason,
    },
  });

  console.log(`[SensitivityResume] Marked call ${callId} as timed out: ${reason}`);
}
