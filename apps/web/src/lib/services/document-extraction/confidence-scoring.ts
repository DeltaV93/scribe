/**
 * Document Extraction - Confidence Scoring
 *
 * Calculates and adjusts confidence scores for extracted field values.
 * Considers field type, validation, and extraction quality.
 */

import type {
  ExtractedFieldValue,
  ExtractableFormField,
  ConfidenceScoringConfig,
} from './types'
import { DEFAULT_CONFIDENCE_CONFIG } from './types'

/**
 * Adjust confidence score based on field validation and type matching
 */
export function adjustConfidence(
  extraction: ExtractedFieldValue,
  field: ExtractableFormField,
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): ExtractedFieldValue {
  let confidence = extraction.confidence
  const validationErrors: string[] = [...extraction.validationErrors]

  // Check for required field with no value
  if (field.isRequired && (extraction.value === null || extraction.value === '')) {
    confidence -= config.missingRequiredPenalty
    if (!validationErrors.includes('Required field not found')) {
      validationErrors.push('Required field is empty')
    }
  }

  // Validate and adjust based on field type
  const typeValidation = validateFieldType(extraction.value, field)
  if (!typeValidation.isValid) {
    confidence -= config.validationErrorPenalty
    validationErrors.push(...typeValidation.errors)
  }

  // Boost confidence for exact option matches
  if (field.options && extraction.value !== null) {
    const options = field.options.map((o) => o.value.toLowerCase())

    if (Array.isArray(extraction.value)) {
      // Checkbox - multiple values
      const allMatch = extraction.value.every((v) =>
        options.includes(String(v).toLowerCase())
      )
      if (allMatch) {
        confidence += config.exactMatchBoost
      }
    } else {
      // Dropdown - single value
      if (options.includes(String(extraction.value).toLowerCase())) {
        confidence += config.exactMatchBoost
      } else {
        // Find closest match
        const closest = findClosestOption(String(extraction.value), field.options)
        if (closest) {
          validationErrors.push(
            `Value "${extraction.value}" not in options. Did you mean "${closest}"?`
          )
        }
      }
    }
  }

  // Clamp confidence to valid range
  confidence = Math.min(1, Math.max(0, confidence))

  return {
    ...extraction,
    confidence,
    needsReview: confidence < config.reviewThreshold,
    validationErrors,
  }
}

/**
 * Validate extracted value against field type
 */
function validateFieldType(
  value: string | number | boolean | string[] | null,
  field: ExtractableFormField
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (value === null || value === '') {
    return { isValid: true, errors }
  }

  switch (field.type) {
    case 'EMAIL':
      if (
        typeof value === 'string' &&
        !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      ) {
        errors.push('Invalid email format')
      }
      break

    case 'PHONE':
      if (typeof value === 'string') {
        const digits = value.replace(/\D/g, '')
        if (digits.length < 10 || digits.length > 15) {
          errors.push('Invalid phone number format')
        }
      }
      break

    case 'DATE':
      if (typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          errors.push('Invalid date format')
        }
      }
      break

    case 'NUMBER':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        errors.push('Value is not a valid number')
      }
      break

    case 'YES_NO':
      if (typeof value !== 'boolean') {
        const strVal = String(value).toLowerCase()
        if (!['true', 'false', 'yes', 'no', '1', '0'].includes(strVal)) {
          errors.push('Value must be yes/no or true/false')
        }
      }
      break

    case 'CHECKBOX':
      if (!Array.isArray(value)) {
        errors.push('Checkbox value should be an array')
      }
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Find closest matching option using Levenshtein distance
 */
function findClosestOption(
  value: string,
  options: { value: string; label: string }[]
): string | null {
  const lowerValue = value.toLowerCase()
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const option of options) {
    const distance = levenshteinDistance(lowerValue, option.value.toLowerCase())
    const labelDistance = levenshteinDistance(lowerValue, option.label.toLowerCase())
    const minDistance = Math.min(distance, labelDistance)

    if (minDistance < bestDistance && minDistance <= 3) {
      bestDistance = minDistance
      bestMatch = option.value
    }
  }

  return bestMatch
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate overall confidence from field extractions
 */
export function calculateOverallConfidence(
  extractions: ExtractedFieldValue[],
  fields: ExtractableFormField[]
): number {
  if (extractions.length === 0) return 0

  // Weight required fields more heavily
  let totalWeight = 0
  let weightedSum = 0

  for (const extraction of extractions) {
    const field = fields.find((f) => f.id === extraction.fieldId)
    const weight = field?.isRequired ? 2 : 1
    totalWeight += weight
    weightedSum += extraction.confidence * weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Categorize extractions by confidence level
 */
export function categorizeByConfidence(
  extractions: ExtractedFieldValue[],
  config: ConfidenceScoringConfig = DEFAULT_CONFIDENCE_CONFIG
): {
  autoApply: ExtractedFieldValue[]
  needsReview: ExtractedFieldValue[]
  lowConfidence: ExtractedFieldValue[]
} {
  const autoApply: ExtractedFieldValue[] = []
  const needsReview: ExtractedFieldValue[] = []
  const lowConfidence: ExtractedFieldValue[] = []

  for (const extraction of extractions) {
    if (extraction.confidence >= config.autoApplyThreshold) {
      autoApply.push(extraction)
    } else if (extraction.confidence >= config.reviewThreshold) {
      needsReview.push(extraction)
    } else {
      lowConfidence.push(extraction)
    }
  }

  return { autoApply, needsReview, lowConfidence }
}

/**
 * Generate confidence summary for UI display
 */
export function generateConfidenceSummary(
  extractions: ExtractedFieldValue[]
): {
  totalFields: number
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  averageConfidence: number
  fieldsNeedingReview: number
  validationErrors: number
} {
  const totalFields = extractions.length
  let highConfidence = 0
  let mediumConfidence = 0
  let lowConfidence = 0
  let validationErrors = 0

  for (const extraction of extractions) {
    if (extraction.confidence >= 0.85) {
      highConfidence++
    } else if (extraction.confidence >= 0.7) {
      mediumConfidence++
    } else {
      lowConfidence++
    }

    if (extraction.validationErrors.length > 0) {
      validationErrors++
    }
  }

  const averageConfidence =
    totalFields > 0
      ? extractions.reduce((sum, e) => sum + e.confidence, 0) / totalFields
      : 0

  return {
    totalFields,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageConfidence,
    fieldsNeedingReview: extractions.filter((e) => e.needsReview).length,
    validationErrors,
  }
}
