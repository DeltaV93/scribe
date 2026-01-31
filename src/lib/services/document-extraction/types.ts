/**
 * Document Extraction Types
 *
 * TypeScript interfaces for the document-to-form-submission extraction feature.
 * Extracts data from photos/PDFs to populate existing form fields.
 */

import type { FieldType } from '@prisma/client'

/**
 * Source document type for extraction
 */
export type DocumentSourceType = 'PHOTO' | 'PDF_CLEAN' | 'PDF_SCANNED'

/**
 * Extraction status
 */
export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

/**
 * Input for starting a document extraction
 */
export interface DocumentExtractionInput {
  orgId: string
  userId: string
  formId: string
  clientId?: string
  filename: string
  mimeType: string
  buffer: Buffer
}

/**
 * Field definition for extraction (subset of form field)
 */
export interface ExtractableFormField {
  id: string
  slug: string
  name: string
  type: FieldType
  helpText?: string | null
  isRequired: boolean
  options?: { value: string; label: string }[] | null
  section?: string | null
}

/**
 * Result of extracting a single field value
 */
export interface ExtractedFieldValue {
  fieldId: string
  fieldSlug: string
  fieldName: string
  fieldType: string
  value: string | number | boolean | string[] | null
  rawValue: string | null
  confidence: number
  reasoning?: string
  sourceSnippet?: string
  needsReview: boolean
  validationErrors: string[]
}

/**
 * Overall extraction result
 */
export interface DocumentExtractionResult {
  success: boolean
  documentText: string
  pageCount: number
  isScanned: boolean
  fields: ExtractedFieldValue[]
  overallConfidence: number
  processingTimeMs: number
  tokensUsed: {
    input: number
    output: number
  }
  warnings: string[]
  error?: string
}

/**
 * Stored extraction record
 */
export interface StoredExtraction {
  id: string
  orgId: string
  formId: string
  clientId?: string | null
  userId: string
  status: ExtractionStatus
  sourceType: DocumentSourceType
  sourcePath: string
  documentText?: string | null
  pageCount?: number | null
  extractedFields: ExtractedFieldValue[] | null
  overallConfidence?: number | null
  processingTimeMs?: number | null
  warnings: string[]
  error?: string | null
  submissionId?: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Options for applying extraction to submission
 */
export interface ApplyExtractionOptions {
  /** Only apply fields above this confidence threshold */
  minConfidence?: number
  /** Overwrite existing values in submission */
  overwriteExisting?: boolean
  /** Field IDs to include (if empty, include all) */
  includeFieldIds?: string[]
  /** Field IDs to exclude */
  excludeFieldIds?: string[]
}

/**
 * Result of applying extraction to submission
 */
export interface ApplyExtractionResult {
  submissionId: string
  appliedFields: number
  skippedFields: number
  details: {
    fieldId: string
    fieldSlug: string
    applied: boolean
    reason?: string
  }[]
}

/**
 * Confidence scoring configuration
 */
export interface ConfidenceScoringConfig {
  /** Base confidence penalty for OCR-based extraction (vs native text) */
  ocrPenalty: number
  /** Confidence boost for exact option matches */
  exactMatchBoost: number
  /** Confidence penalty for required field with no value */
  missingRequiredPenalty: number
  /** Confidence penalty for validation errors */
  validationErrorPenalty: number
  /** Minimum confidence threshold for auto-apply */
  autoApplyThreshold: number
  /** Threshold below which field needs manual review */
  reviewThreshold: number
}

/**
 * Default confidence scoring configuration
 */
export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceScoringConfig = {
  ocrPenalty: 0.05,
  exactMatchBoost: 0.1,
  missingRequiredPenalty: 0.3,
  validationErrorPenalty: 0.2,
  autoApplyThreshold: 0.85,
  reviewThreshold: 0.7,
}
