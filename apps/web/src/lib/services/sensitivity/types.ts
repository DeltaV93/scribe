/**
 * TypeScript types for Sensitivity Detection.
 * PX-878: Tiered Content Classifier
 */

import type { SensitivityTier } from "@prisma/client";

// Re-export the Prisma enum for convenience
export { SensitivityTier };

/**
 * Sensitivity category classification.
 */
export type SensitivityCategory =
  | "PERSONAL_OFF_TOPIC"
  | "HR_SENSITIVE"
  | "LEGAL_SENSITIVE"
  | "HEALTH_SENSITIVE"
  | "FINANCIAL_SENSITIVE";

/**
 * Named entity detected in segment.
 */
export interface EntitySignal {
  text: string;
  label: string; // PERSON, ORG, DATE, etc.
  start: number;
  end: number;
  sensitivity: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Sentiment analysis result.
 */
export interface SentimentSignal {
  compound: number; // VADER compound score (-1 to 1)
  positive: number; // Positive score (0 to 1)
  negative: number; // Negative score (0 to 1)
  neutral: number; // Neutral score (0 to 1)
  category: "PERSONAL" | "PROFESSIONAL" | "NEUTRAL";
}

/**
 * Taxonomy pattern match.
 */
export interface TaxonomySignal {
  pattern: string;
  category: string;
  tier: SensitivityTier;
  score: number;
}

/**
 * All signals extracted from a segment.
 */
export interface SegmentSignals {
  entities: EntitySignal[];
  sentiment: SentimentSignal;
  taxonomy: TaxonomySignal[];
}

/**
 * Classification result for a single segment.
 */
export interface SensitivitySegmentResult {
  segmentIndex: number;
  startTime: number;
  endTime: number;
  text: string;
  tier: SensitivityTier;
  confidence: number;
  category?: SensitivityCategory;
  signals: SegmentSignals;
  needsReview: boolean;
  reviewReason?: string;
}

/**
 * Overall sensitivity classification result.
 */
export interface SensitivityResult {
  success: boolean;
  segments: SensitivitySegmentResult[];
  overallTier: SensitivityTier;
  confidence: number;
  modelVersion: string;
  requiresReview: boolean;
  blockReason?: string;
  processingTimeMs: number;
}

/**
 * Input for human review submission.
 */
export interface SensitivityReviewInput {
  callId: string;
  segmentIndex: number;
  action: "CONFIRM" | "DISPUTE";
  newTier?: SensitivityTier; // Required if action = DISPUTE
  reason?: string;
}

/**
 * Transcript segment for classification.
 */
export interface TranscriptSegment {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

/**
 * Model version info.
 */
export interface SensitivityModelInfo {
  version: string;
  orgId: string | null;
  isActive: boolean;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingSize?: number;
  trainedAt?: string;
}

/**
 * Retraining job info.
 */
export interface RetrainingJob {
  id: string;
  orgId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ROLLED_BACK";
  triggerReason: string;
  labelCount: number;
  previousVersion?: string;
  newVersion?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * Events tracked for sensitivity detection.
 */
export const SENSITIVITY_EVENTS = {
  DETECTED: "sensitivity.detected",
  CONFIRMED: "sensitivity.confirmed",
  DISPUTED: "sensitivity.disputed",
  TIER_APPLIED: "sensitivity.tier_applied",
  REVIEW_BLOCKED: "sensitivity.review_blocked",
  MODEL_RETRAINED: "sensitivity.model_retrained",
  MODEL_ROLLED_BACK: "sensitivity.model_rolled_back",
  SERVICE_UNAVAILABLE: "sensitivity.service_unavailable",
} as const;
