/**
 * Call ML Integration Service
 *
 * Integrates ML services (form matching, segment detection) into the call processing pipeline.
 * Handles ML service unavailability gracefully with fallback to manual form selection.
 */

import { prisma } from "@/lib/db";
import mlServices from "@/lib/ml-services/client";
import { MLServiceApiError } from "@/lib/ml-services/types";
import type { MatchResult, Segment, Industry } from "@/lib/ml-services/types";

// Configuration
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;
const ML_SERVICE_TIMEOUT_MS = 10000;

// Types
export interface FormMatch {
  formId: string;
  formName: string;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low" | "insufficient";
  matchedSignals: Array<{
    type: string;
    value: string;
    weight: number;
  }>;
  segment?: {
    startTime: number | null;
    endTime: number | null;
    segmentType: string;
  };
  isAutoSuggested: boolean;
}

export interface FormMatchingResult {
  success: boolean;
  matches: FormMatch[];
  totalFormsChecked: number;
  processingTimeMs: number;
  mlServiceUsed: boolean;
  error?: string;
}

export interface SegmentDetectionResult {
  success: boolean;
  segments: Segment[];
  totalSegments: number;
  processingTimeMs: number;
  error?: string;
}

export interface MLIntegrationStatus {
  available: boolean;
  lastChecked: Date;
  error?: string;
}

// Module-level cache for ML service availability
let mlServiceStatus: MLIntegrationStatus = {
  available: true,
  lastChecked: new Date(),
};

const ML_STATUS_CACHE_MS = 60000; // 1 minute

/**
 * Check if ML services are available
 */
export async function checkMLServiceAvailability(): Promise<boolean> {
  const now = new Date();
  const cacheAge = now.getTime() - mlServiceStatus.lastChecked.getTime();

  // Use cached status if recent
  if (cacheAge < ML_STATUS_CACHE_MS) {
    return mlServiceStatus.available;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await mlServices.health.check();
    clearTimeout(timeoutId);

    mlServiceStatus = {
      available: true,
      lastChecked: now,
    };
    return true;
  } catch (error) {
    console.warn("[CallMLIntegration] ML service health check failed:", error);
    mlServiceStatus = {
      available: false,
      lastChecked: now,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return false;
  }
}

/**
 * Get available forms for an organization as candidates for matching
 */
async function getFormCandidates(
  orgId: string
): Promise<Array<{ id: string; name: string; keywords?: string[] }>> {
  const forms = await prisma.form.findMany({
    where: {
      orgId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      name: true,
      settings: true,
    },
  });

  return forms.map((form) => {
    // Extract keywords from form settings if available
    const settings = form.settings as { keywords?: string[] } | null;
    return {
      id: form.id,
      name: form.name,
      keywords: settings?.keywords,
    };
  });
}

/**
 * Get organization industry for ML matching context
 */
async function getOrgIndustry(orgId: string): Promise<Industry | undefined> {
  try {
    const profile = await mlServices.orgProfile.get(orgId);
    return profile.industry || undefined;
  } catch (error) {
    // Org profile may not exist yet
    if (error instanceof MLServiceApiError && error.code === "ORG_PROFILE_NOT_FOUND") {
      return undefined;
    }
    console.warn("[CallMLIntegration] Failed to get org profile:", error);
    return undefined;
  }
}

/**
 * Detect forms from a transcript using ML services
 *
 * @param transcript - The call transcript text
 * @param orgId - Organization ID
 * @returns Matched forms with confidence scores
 */
export async function detectFormsFromTranscript(
  transcript: string,
  orgId: string
): Promise<FormMatchingResult> {
  const startTime = Date.now();

  // Check ML service availability
  const isAvailable = await checkMLServiceAvailability();
  if (!isAvailable) {
    console.log("[CallMLIntegration] ML service unavailable, skipping form matching");
    return {
      success: false,
      matches: [],
      totalFormsChecked: 0,
      processingTimeMs: Date.now() - startTime,
      mlServiceUsed: false,
      error: "ML service unavailable",
    };
  }

  try {
    // Get form candidates and org context
    const [formCandidates, industry] = await Promise.all([
      getFormCandidates(orgId),
      getOrgIndustry(orgId),
    ]);

    if (formCandidates.length === 0) {
      return {
        success: true,
        matches: [],
        totalFormsChecked: 0,
        processingTimeMs: Date.now() - startTime,
        mlServiceUsed: true,
      };
    }

    // Call ML matching service
    const matchResponse = await mlServices.matching.matchForms({
      transcript,
      org_id: orgId,
      form_candidates: formCandidates,
    });

    // Transform response to our format
    const matches: FormMatch[] = matchResponse.matches.map((match: MatchResult) => ({
      formId: match.form_id,
      formName: match.form_name,
      confidence: match.confidence,
      confidenceLevel: match.confidence_level,
      matchedSignals: match.matched_signals.map((s) => ({
        type: s.signal.type,
        value: s.signal.value,
        weight: s.weight,
      })),
      segment: match.segment
        ? {
            startTime: match.segment.start_time,
            endTime: match.segment.end_time,
            segmentType: match.segment.segment_type,
          }
        : undefined,
      isAutoSuggested: match.confidence >= HIGH_CONFIDENCE_THRESHOLD,
    }));

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    return {
      success: true,
      matches,
      totalFormsChecked: matchResponse.total_forms_checked,
      processingTimeMs: matchResponse.processing_time_ms,
      mlServiceUsed: true,
    };
  } catch (error) {
    console.error("[CallMLIntegration] Form matching failed:", error);

    // Update service status on error
    if (error instanceof MLServiceApiError) {
      mlServiceStatus = {
        available: false,
        lastChecked: new Date(),
        error: error.message,
      };
    }

    return {
      success: false,
      matches: [],
      totalFormsChecked: 0,
      processingTimeMs: Date.now() - startTime,
      mlServiceUsed: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Detect segments in a transcript
 *
 * @param transcript - The call transcript text
 * @param orgId - Organization ID
 * @param timestamps - Optional timestamp data from transcription
 */
export async function detectTranscriptSegments(
  transcript: string,
  orgId: string,
  timestamps?: Array<{ time: number; text: string }>
): Promise<SegmentDetectionResult> {
  const startTime = Date.now();

  // Check ML service availability
  const isAvailable = await checkMLServiceAvailability();
  if (!isAvailable) {
    return {
      success: false,
      segments: [],
      totalSegments: 0,
      processingTimeMs: Date.now() - startTime,
      error: "ML service unavailable",
    };
  }

  try {
    const industry = await getOrgIndustry(orgId);

    const response = await mlServices.matching.detectSegments({
      transcript,
      industry,
      timestamps,
    });

    return {
      success: true,
      segments: response.segments,
      totalSegments: response.total_segments,
      processingTimeMs: response.processing_time_ms,
    };
  } catch (error) {
    console.error("[CallMLIntegration] Segment detection failed:", error);

    return {
      success: false,
      segments: [],
      totalSegments: 0,
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get the best auto-suggested form from matches
 *
 * @param matches - Form matches from detectFormsFromTranscript
 * @returns The best high-confidence match, or null if none
 */
export function getBestAutoSuggestedForm(matches: FormMatch[]): FormMatch | null {
  const highConfidenceMatches = matches.filter((m) => m.isAutoSuggested);
  return highConfidenceMatches.length > 0 ? highConfidenceMatches[0] : null;
}

/**
 * Get all suggested forms (high and medium confidence)
 *
 * @param matches - Form matches from detectFormsFromTranscript
 * @returns Forms to show as options to the user
 */
export function getSuggestedForms(matches: FormMatch[]): FormMatch[] {
  return matches.filter(
    (m) => m.confidence >= MEDIUM_CONFIDENCE_THRESHOLD
  );
}

/**
 * Store form matching results on a call record
 */
export async function storeFormMatchingResults(
  callId: string,
  results: FormMatchingResult
): Promise<void> {
  await prisma.call.update({
    where: { id: callId },
    data: {
      mlMatchedForms: results.matches.map((m) => ({
        formId: m.formId,
        formName: m.formName,
        confidence: m.confidence,
        confidenceLevel: m.confidenceLevel,
        isAutoSuggested: m.isAutoSuggested,
        matchedSignals: m.matchedSignals,
        segment: m.segment,
      })) as object,
      mlMatchingTimestamp: new Date(),
      mlServiceUsed: results.mlServiceUsed,
    },
  });
}

/**
 * Get stored form matching results for a call
 */
export async function getStoredFormMatches(
  callId: string
): Promise<FormMatch[] | null> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      mlMatchedForms: true,
    },
  });

  if (!call?.mlMatchedForms) {
    return null;
  }

  return call.mlMatchedForms as unknown as FormMatch[];
}

/**
 * Emit audit event for form matching via ML services
 */
export async function auditFormMatching(
  orgId: string,
  userId: string | null,
  callId: string,
  results: FormMatchingResult,
  selectedFormId?: string
): Promise<void> {
  try {
    await mlServices.auditEnhanced.createEventAutoTier({
      org_id: orgId,
      event_type: "call.form_matched",
      actor_id: userId || "system",
      actor_type: userId ? "user" : "system",
      event_data: {
        call_id: callId,
        total_matches: results.matches.length,
        total_forms_checked: results.totalFormsChecked,
        processing_time_ms: results.processingTimeMs,
        ml_service_used: results.mlServiceUsed,
        selected_form_id: selectedFormId,
        high_confidence_matches: results.matches.filter((m) => m.isAutoSuggested).length,
        top_match: results.matches[0]
          ? {
              form_id: results.matches[0].formId,
              confidence: results.matches[0].confidence,
              confidence_level: results.matches[0].confidenceLevel,
            }
          : null,
      },
      source_service: "inkra-nextjs",
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log but don't fail - audit is non-critical
    console.error("[CallMLIntegration] Failed to emit form matching audit event:", error);
  }
}

/**
 * Emit audit event for form selection
 */
export async function auditFormSelection(
  orgId: string,
  userId: string,
  callId: string,
  formId: string,
  formName: string,
  confidence: number | null,
  wasAutoSuggested: boolean
): Promise<void> {
  try {
    await mlServices.auditEnhanced.createEventAutoTier({
      org_id: orgId,
      event_type: "call.form_selected",
      actor_id: userId,
      actor_type: "user",
      event_data: {
        call_id: callId,
        form_id: formId,
        form_name: formName,
        ml_confidence: confidence,
        was_auto_suggested: wasAutoSuggested,
        selection_method: wasAutoSuggested ? "auto_suggested" : "manual",
      },
      source_service: "inkra-nextjs",
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log but don't fail - audit is non-critical
    console.error("[CallMLIntegration] Failed to emit form selection audit event:", error);
  }
}
