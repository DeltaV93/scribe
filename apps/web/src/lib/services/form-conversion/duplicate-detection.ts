/**
 * Form Conversion Duplicate Detection Service
 *
 * Detects duplicate or similar forms using field fingerprinting and Jaccard similarity.
 * Helps prevent creating duplicate forms from multiple document uploads.
 */

import { prisma } from '@/lib/db'
import type { DetectedField } from './field-detection'

export interface DuplicateCheckResult {
  hasDuplicate: boolean
  duplicateFormId?: string
  duplicateFormName?: string
  similarity: number
  matchType: 'exact' | 'high' | 'medium' | 'low' | 'none'
}

export interface SimilarForm {
  formId: string
  formName: string
  similarity: number
  matchingFields: string[]
}

// Similarity thresholds
const SIMILARITY_THRESHOLDS = {
  exact: 0.95,
  high: 0.8,
  medium: 0.6,
  low: 0.4,
}

/**
 * Generate a fingerprint for a set of fields
 */
export function generateFieldFingerprint(fields: DetectedField[]): string {
  // Sort fields by name for consistent ordering
  const sortedFields = [...fields].sort((a, b) => a.name.localeCompare(b.name))

  // Create fingerprint from field names and types
  const components = sortedFields.map((f) => `${normalizeLabel(f.name)}:${f.type}`)

  // Hash the components
  return hashComponents(components)
}

/**
 * Check for duplicate forms in the organization
 */
export async function checkForDuplicates(
  orgId: string,
  fields: DetectedField[]
): Promise<DuplicateCheckResult> {
  const fingerprint = generateFieldFingerprint(fields)

  // First, check for exact fingerprint match
  const exactMatch = await prisma.form.findFirst({
    where: {
      orgId,
      fieldFingerprint: fingerprint,
      status: { not: 'ARCHIVED' },
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (exactMatch) {
    return {
      hasDuplicate: true,
      duplicateFormId: exactMatch.id,
      duplicateFormName: exactMatch.name,
      similarity: 1.0,
      matchType: 'exact',
    }
  }

  // If no exact match, check for similar forms using Jaccard similarity
  const similarForms = await findSimilarForms(orgId, fields)

  if (similarForms.length > 0) {
    const mostSimilar = similarForms[0]

    if (mostSimilar.similarity >= SIMILARITY_THRESHOLDS.high) {
      return {
        hasDuplicate: true,
        duplicateFormId: mostSimilar.formId,
        duplicateFormName: mostSimilar.formName,
        similarity: mostSimilar.similarity,
        matchType: mostSimilar.similarity >= SIMILARITY_THRESHOLDS.exact ? 'exact' : 'high',
      }
    }

    if (mostSimilar.similarity >= SIMILARITY_THRESHOLDS.medium) {
      return {
        hasDuplicate: false, // Not a duplicate, but similar
        duplicateFormId: mostSimilar.formId,
        duplicateFormName: mostSimilar.formName,
        similarity: mostSimilar.similarity,
        matchType: 'medium',
      }
    }
  }

  return {
    hasDuplicate: false,
    similarity: 0,
    matchType: 'none',
  }
}

/**
 * Find forms similar to the given fields
 */
export async function findSimilarForms(
  orgId: string,
  fields: DetectedField[],
  limit: number = 5
): Promise<SimilarForm[]> {
  // Get all forms with their fields
  const forms = await prisma.form.findMany({
    where: {
      orgId,
      status: { not: 'ARCHIVED' },
    },
    select: {
      id: true,
      name: true,
      fields: {
        select: {
          name: true,
          type: true,
          slug: true,
        },
      },
    },
  })

  // Calculate similarity for each form
  const inputFieldSet = new Set(fields.map((f) => normalizeLabel(f.name)))

  const similarities: SimilarForm[] = forms
    .map((form) => {
      const formFieldSet = new Set(form.fields.map((f) => normalizeLabel(f.name)))
      const { similarity, intersection } = calculateJaccardSimilarity(inputFieldSet, formFieldSet)

      return {
        formId: form.id,
        formName: form.name,
        similarity,
        matchingFields: intersection,
      }
    })
    .filter((s) => s.similarity > SIMILARITY_THRESHOLDS.low)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return similarities
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function calculateJaccardSimilarity(
  setA: Set<string>,
  setB: Set<string>
): { similarity: number; intersection: string[] } {
  const intersection: string[] = []

  for (const item of setA) {
    if (setB.has(item)) {
      intersection.push(item)
    }
  }

  const union = new Set([...setA, ...setB])

  const similarity = union.size > 0 ? intersection.length / union.size : 0

  return { similarity, intersection }
}

/**
 * Calculate weighted similarity including field types
 */
export function calculateWeightedSimilarity(
  fieldsA: Array<{ name: string; type: string }>,
  fieldsB: Array<{ name: string; type: string }>
): number {
  const mapA = new Map(fieldsA.map((f) => [normalizeLabel(f.name), f.type]))
  const mapB = new Map(fieldsB.map((f) => [normalizeLabel(f.name), f.type]))

  let matchScore = 0
  let totalFields = 0

  // Check fields in A against B
  for (const [name, typeA] of mapA) {
    totalFields++
    if (mapB.has(name)) {
      const typeB = mapB.get(name)
      // Full point for name + type match, half point for name only
      matchScore += typeA === typeB ? 1 : 0.5
    }
  }

  // Add fields only in B to total
  for (const name of mapB.keys()) {
    if (!mapA.has(name)) {
      totalFields++
    }
  }

  return totalFields > 0 ? matchScore / totalFields : 0
}

/**
 * Update a form's fingerprint
 */
export async function updateFormFingerprint(formId: string): Promise<void> {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      fields: {
        select: {
          name: true,
          type: true,
        },
      },
    },
  })

  if (!form) return

  const fields = form.fields.map((f) => ({
    name: f.name,
    type: f.type,
    slug: '',
    purpose: 'OTHER' as const,
    isRequired: false,
    isSensitive: false,
    order: 0,
    confidence: 1,
    sourceLabel: f.name,
  }))

  const fingerprint = generateFieldFingerprint(fields)

  await prisma.form.update({
    where: { id: formId },
    data: { fieldFingerprint: fingerprint },
  })
}

// Helper functions

/**
 * Normalize a label for comparison
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Simple hash function for fingerprinting
 */
function hashComponents(components: string[]): string {
  const str = components.join('|')
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Get match type description
 */
export function getMatchTypeDescription(matchType: DuplicateCheckResult['matchType']): string {
  const descriptions: Record<string, string> = {
    exact: 'This appears to be an exact duplicate of an existing form.',
    high: 'This is very similar to an existing form. Consider using the existing form instead.',
    medium: 'This has some similarities to an existing form. Review before creating.',
    low: 'This has minor similarities to existing forms.',
    none: 'No similar forms found.',
  }
  return descriptions[matchType] || descriptions.none
}
