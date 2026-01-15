import type { FieldExtractionResult } from "./types";
import type { TranscriptSegment } from "@/lib/deepgram/transcribe";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceBreakdown {
  overall: number;
  level: ConfidenceLevel;
  factors: {
    directStatement: number; // 40% weight - explicit statement by client
    contextMatch: number; // 30% weight - surrounding context supports value
    formatValidation: number; // 20% weight - value matches expected format
    multipleConfirmations: number; // 10% weight - value mentioned multiple times
  };
  warnings: string[];
}

interface ConfidenceFactors {
  directStatement: number;
  contextMatch: number;
  formatValidation: number;
  multipleConfirmations: number;
}

// Weights for confidence calculation
const WEIGHTS = {
  directStatement: 0.4,
  contextMatch: 0.3,
  formatValidation: 0.2,
  multipleConfirmations: 0.1,
};

// Thresholds for confidence levels
const THRESHOLDS = {
  high: 90,
  medium: 60,
};

/**
 * Calculate confidence score for a field extraction
 */
export function calculateConfidence(
  extraction: FieldExtractionResult,
  transcript: TranscriptSegment[],
  fieldType: string
): ConfidenceBreakdown {
  const warnings: string[] = [];

  // Factor 1: Direct statement score (from AI extraction)
  const directStatement = extraction.confidence;

  // Factor 2: Context match - check if surrounding context supports the value
  const contextMatch = calculateContextMatch(
    extraction,
    transcript,
    warnings
  );

  // Factor 3: Format validation - check if value matches expected format
  const formatValidation = validateFormat(
    extraction.value,
    fieldType,
    warnings
  );

  // Factor 4: Multiple confirmations - check if value appears multiple times
  const multipleConfirmations = checkMultipleConfirmations(
    extraction,
    transcript,
    warnings
  );

  // Calculate weighted overall score
  const overall = Math.round(
    directStatement * WEIGHTS.directStatement +
      contextMatch * WEIGHTS.contextMatch +
      formatValidation * WEIGHTS.formatValidation +
      multipleConfirmations * WEIGHTS.multipleConfirmations
  );

  // Determine confidence level
  let level: ConfidenceLevel;
  if (overall >= THRESHOLDS.high) {
    level = "high";
  } else if (overall >= THRESHOLDS.medium) {
    level = "medium";
  } else {
    level = "low";
  }

  return {
    overall,
    level,
    factors: {
      directStatement,
      contextMatch,
      formatValidation,
      multipleConfirmations,
    },
    warnings,
  };
}

/**
 * Calculate context match score
 */
function calculateContextMatch(
  extraction: FieldExtractionResult,
  transcript: TranscriptSegment[],
  warnings: string[]
): number {
  if (!extraction.sourceSnippet) {
    warnings.push("No source snippet provided");
    return 50;
  }

  // Find the segment containing the source snippet
  const sourceSegment = transcript.find((s) =>
    s.text.toLowerCase().includes(extraction.sourceSnippet!.toLowerCase().substring(0, 50))
  );

  if (!sourceSegment) {
    warnings.push("Source snippet not found in transcript");
    return 40;
  }

  // Check if the statement was made by the client
  if (sourceSegment.speaker !== "CLIENT") {
    warnings.push("Value was not stated by the client");
    return 30;
  }

  // Check confidence of the transcription itself
  if (sourceSegment.confidence < 0.8) {
    warnings.push("Low transcription confidence for this segment");
    return 60;
  }

  // Good context match
  return 90;
}

/**
 * Validate value format based on field type
 */
function validateFormat(
  value: string | number | boolean | string[] | null,
  fieldType: string,
  warnings: string[]
): number {
  if (value === null) {
    return 0;
  }

  const stringValue = String(value);

  switch (fieldType.toLowerCase()) {
    case "phone":
      // Phone number format validation
      const phoneDigits = stringValue.replace(/\D/g, "");
      if (phoneDigits.length === 10) return 100;
      if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) return 100;
      warnings.push("Phone number format may be incorrect");
      return 50;

    case "email":
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(stringValue)) return 100;
      warnings.push("Email format may be incorrect");
      return 30;

    case "date":
      // Date format validation
      const date = new Date(stringValue);
      if (!isNaN(date.getTime())) return 100;
      warnings.push("Date format may be incorrect");
      return 40;

    case "ssn":
      // SSN format validation (XXX-XX-XXXX or XXXXXXXXX)
      const ssnDigits = stringValue.replace(/\D/g, "");
      if (ssnDigits.length === 9) return 100;
      warnings.push("SSN format may be incorrect");
      return 30;

    case "zip":
      // ZIP code validation
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (zipRegex.test(stringValue)) return 100;
      warnings.push("ZIP code format may be incorrect");
      return 50;

    case "number":
    case "currency":
      // Number validation
      if (!isNaN(parseFloat(stringValue))) return 100;
      warnings.push("Numeric value may be incorrect");
      return 40;

    case "dropdown":
    case "radio":
    case "select":
      // For selection fields, trust the AI extraction
      return 85;

    default:
      // For text fields, basic validation
      if (stringValue.trim().length > 0) return 85;
      return 50;
  }
}

/**
 * Check if the value was confirmed multiple times in the transcript
 */
function checkMultipleConfirmations(
  extraction: FieldExtractionResult,
  transcript: TranscriptSegment[],
  warnings: string[]
): number {
  if (extraction.value === null) return 0;

  const stringValue = String(extraction.value).toLowerCase();
  const clientStatements = transcript
    .filter((s) => s.speaker === "CLIENT")
    .map((s) => s.text.toLowerCase());

  let mentionCount = 0;
  for (const statement of clientStatements) {
    if (statement.includes(stringValue) || fuzzyMatch(statement, stringValue)) {
      mentionCount++;
    }
  }

  if (mentionCount >= 3) return 100;
  if (mentionCount === 2) return 80;
  if (mentionCount === 1) return 60;

  warnings.push("Value was not clearly mentioned by client");
  return 30;
}

/**
 * Simple fuzzy match for similar values
 */
function fuzzyMatch(text: string, value: string): boolean {
  // For numbers, check if the digits appear
  const valueDigits = value.replace(/\D/g, "");
  if (valueDigits.length >= 4) {
    return text.includes(valueDigits);
  }

  // For words, check for partial match
  const words = value.split(/\s+/);
  return words.some((word) => word.length > 3 && text.includes(word));
}

/**
 * Calculate confidence scores for all extracted fields
 */
export function calculateAllConfidenceScores(
  extractions: FieldExtractionResult[],
  transcript: TranscriptSegment[],
  fieldTypes: Record<string, string>
): Record<string, ConfidenceBreakdown> {
  const scores: Record<string, ConfidenceBreakdown> = {};

  for (const extraction of extractions) {
    const fieldType = fieldTypes[extraction.slug] || "text";
    scores[extraction.slug] = calculateConfidence(
      extraction,
      transcript,
      fieldType
    );
  }

  return scores;
}

/**
 * Get confidence color for UI display
 */
export function getConfidenceColor(score: number): string {
  if (score >= THRESHOLDS.high) return "green";
  if (score >= THRESHOLDS.medium) return "yellow";
  return "red";
}

/**
 * Check if a field needs human review based on confidence
 */
export function needsHumanReview(confidence: ConfidenceBreakdown): boolean {
  // Low confidence always needs review
  if (confidence.level === "low") return true;

  // Any warnings trigger review
  if (confidence.warnings.length > 0) return true;

  // Low individual factors trigger review
  if (confidence.factors.directStatement < 60) return true;
  if (confidence.factors.formatValidation < 50) return true;

  return false;
}

/**
 * Summarize confidence across all fields
 */
export function summarizeConfidence(
  scores: Record<string, ConfidenceBreakdown>
): {
  overall: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  needsReview: number;
} {
  const breakdowns = Object.values(scores);

  if (breakdowns.length === 0) {
    return {
      overall: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      needsReview: 0,
    };
  }

  const overall = Math.round(
    breakdowns.reduce((sum, b) => sum + b.overall, 0) / breakdowns.length
  );

  const highConfidence = breakdowns.filter((b) => b.level === "high").length;
  const mediumConfidence = breakdowns.filter((b) => b.level === "medium").length;
  const lowConfidence = breakdowns.filter((b) => b.level === "low").length;
  const needsReview = breakdowns.filter((b) => needsHumanReview(b)).length;

  return {
    overall,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    needsReview,
  };
}
