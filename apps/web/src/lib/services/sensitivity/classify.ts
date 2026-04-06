/**
 * Main sensitivity classification function.
 * PX-878: Tiered Content Classifier
 *
 * This is the primary integration point for the call processing pipeline.
 */

import type { TranscriptSegment } from "@/lib/deepgram/transcribe";
import {
  getSensitivityClient,
  isSensitivityEnabled,
  SensitivityServiceError,
} from "./client";
import type {
  SensitivityResult,
  SensitivitySegmentResult,
  TranscriptSegment as SensitivityTranscriptSegment,
} from "./types";

/**
 * Classify transcript segments for sensitivity.
 *
 * This function:
 * 1. Transforms Deepgram segments to NLP service format
 * 2. Calls the Python NLP service for classification
 * 3. Returns classification results with review flags
 *
 * If the service is unavailable, returns a fallback result that doesn't
 * block the pipeline (logs warning and continues).
 *
 * @param segments - Transcript segments from Deepgram
 * @param orgId - Organization ID
 * @param callId - Optional call ID for tracking
 * @param conversationId - Optional conversation ID
 * @returns Sensitivity classification results
 */
export async function classifySensitivity(
  segments: TranscriptSegment[],
  orgId: string,
  callId?: string,
  conversationId?: string
): Promise<SensitivityResult> {
  // Check if sensitivity detection is enabled
  if (!isSensitivityEnabled()) {
    console.log("[Sensitivity] Service not enabled, skipping classification");
    return createFallbackResult(segments, "Service not enabled");
  }

  // Handle empty segments
  if (!segments || segments.length === 0) {
    return {
      success: true,
      segments: [],
      overallTier: "STANDARD",
      confidence: 1.0,
      modelVersion: "fallback",
      requiresReview: false,
      processingTimeMs: 0,
    };
  }

  try {
    const client = getSensitivityClient();

    // Transform Deepgram segments to NLP service format
    const nlpSegments: SensitivityTranscriptSegment[] = segments.map(
      (segment, index) => ({
        index,
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: segment.text,
        speaker: segment.speaker,
      })
    );

    // Call NLP service
    const result = await client.classify(
      nlpSegments,
      orgId,
      callId,
      conversationId
    );

    console.log(
      `[Sensitivity] Classified ${segments.length} segments: ` +
      `tier=${result.overallTier}, confidence=${result.confidence.toFixed(2)}, ` +
      `requiresReview=${result.requiresReview}`
    );

    return result;
  } catch (error) {
    // Log error and return fallback
    if (error instanceof SensitivityServiceError) {
      console.error(
        `[Sensitivity] Service error: ${error.code} - ${error.message}`
      );
    } else {
      console.error(`[Sensitivity] Unexpected error:`, error);
    }

    // Track service unavailability
    // TODO: trackEvent(SENSITIVITY_EVENTS.SERVICE_UNAVAILABLE, { orgId, callId, error })

    // Return fallback that doesn't block pipeline
    return createFallbackResult(
      segments,
      error instanceof Error ? error.message : "Service unavailable"
    );
  }
}

/**
 * Create a fallback result when service is unavailable.
 * Marks all segments as STANDARD with a note about service unavailability.
 */
function createFallbackResult(
  segments: TranscriptSegment[],
  reason: string
): SensitivityResult {
  const fallbackSegments: SensitivitySegmentResult[] = segments.map(
    (segment, index) => ({
      segmentIndex: index,
      startTime: segment.startTime,
      endTime: segment.endTime,
      text: segment.text,
      tier: "STANDARD" as const,
      confidence: 0.5, // Low confidence indicates uncertainty
      signals: {
        entities: [],
        sentiment: {
          compound: 0,
          positive: 0,
          negative: 0,
          neutral: 1,
          category: "NEUTRAL" as const,
        },
        taxonomy: [],
      },
      needsReview: false,
      reviewReason: `Service unavailable: ${reason}`,
    })
  );

  return {
    success: false,
    segments: fallbackSegments,
    overallTier: "STANDARD",
    confidence: 0.5,
    modelVersion: "fallback",
    requiresReview: false,
    blockReason: undefined, // Don't block on service failure
    processingTimeMs: 0,
  };
}

/**
 * Check if a sensitivity result requires blocking the pipeline.
 *
 * Pipeline should be blocked when:
 * - REDACTED content is detected
 * - OR confidence is below threshold and content is potentially sensitive
 */
export function shouldBlockPipeline(result: SensitivityResult): boolean {
  // Don't block on service failure
  if (!result.success) {
    return false;
  }

  // Block if any segment needs review
  return result.requiresReview;
}

/**
 * Get segments that require human review.
 */
export function getSegmentsRequiringReview(
  result: SensitivityResult
): SensitivitySegmentResult[] {
  return result.segments.filter((segment) => segment.needsReview);
}

/**
 * Determine overall tier from segment results.
 * Returns the highest risk tier found.
 */
export function determineOverallTier(
  segments: SensitivitySegmentResult[]
): "STANDARD" | "RESTRICTED" | "REDACTED" {
  if (segments.some((s) => s.tier === "REDACTED")) {
    return "REDACTED";
  }
  if (segments.some((s) => s.tier === "RESTRICTED")) {
    return "RESTRICTED";
  }
  return "STANDARD";
}
