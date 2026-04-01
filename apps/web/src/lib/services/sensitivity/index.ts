/**
 * Sensitivity Detection Service
 * PX-878: Tiered Content Classifier
 *
 * This module exports all sensitivity detection functionality.
 */

// Types
export * from "./types";

// Client
export {
  SensitivityClient,
  SensitivityServiceError,
  getSensitivityClient,
  isSensitivityConfigured,
  isSensitivityEnabled,
} from "./client";

// Classification
export {
  classifySensitivity,
  shouldBlockPipeline,
  getSegmentsRequiringReview,
  determineOverallTier,
} from "./classify";

// Audit
export {
  logSensitivityDecision,
  getCallAuditLogs,
  getDisputeCount,
  getConfirmationRate,
  type SensitivityAction,
  type SensitivityAuditInput,
} from "./audit";

// Resume processing
export {
  resumeAfterSensitivityReview,
  isBlockedForSensitivityReview,
  getCallsPendingReview,
  markReviewTimedOut,
} from "./resume-processing";
