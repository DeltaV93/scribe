/**
 * NLP Module (PX-865)
 * Exports for sensitivity detection and content classification
 */

export {
  detectSensitivity,
  detectSensitivityBatch,
  containsSensitiveContent,
  type TranscriptSegment,
  type SensitivityResult,
  type FlaggedSegmentResult,
  type DetectionResult,
} from "./sensitivity-detector";

export {
  SENSITIVITY_CATEGORIES,
  TIER_DESCRIPTIONS,
  CATEGORY_DESCRIPTIONS,
  getCategoryDefinition,
  getAllKeywords,
  type CategoryDefinition,
} from "./categories";
