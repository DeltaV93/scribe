/**
 * Form Conversion Field Detection Service
 *
 * AI-powered detection and mapping of form fields from document analysis.
 * Converts OCR results into Scrybe form field definitions.
 */

import Anthropic from '@anthropic-ai/sdk'
import { FieldType, FieldPurpose } from '@prisma/client'
import type { OcrResult, DetectedFormElement } from './ocr'

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

export interface DetectedField {
  slug: string
  name: string
  type: FieldType
  purpose: FieldPurpose
  purposeNote?: string
  helpText?: string
  isRequired: boolean
  isSensitive: boolean
  options?: string[]
  section?: string
  order: number
  confidence: number
  sourceLabel: string
  sourcePosition?: {
    x: number
    y: number
    width: number
    height: number
    page: number
  }
}

export interface FieldDetectionResult {
  fields: DetectedField[]
  suggestedFormName: string
  suggestedFormType: string
  sections: string[]
  warnings: string[]
  overallConfidence: number
}

/**
 * Detect and map form fields from OCR results
 */
export async function detectFields(ocrResult: OcrResult): Promise<FieldDetectionResult> {
  const warnings: string[] = []

  // If OCR found structured fields, use them as a starting point
  const baseFields = ocrResult.structure.fields || []

  // Use AI to enhance and validate field detection
  const enhancedResult = await enhanceFieldDetection(ocrResult)

  // Merge OCR-detected fields with AI-enhanced fields
  const mergedFields = mergeFieldDetections(baseFields, enhancedResult.fields)

  // Map to Scrybe field types
  const mappedFields = mergedFields.map((field, index) => mapToScrybeField(field, index))

  // Extract unique sections
  const sections = [...new Set(mappedFields.map((f) => f.section).filter(Boolean))] as string[]

  // Calculate overall confidence
  const overallConfidence =
    mappedFields.length > 0
      ? mappedFields.reduce((sum, f) => sum + f.confidence, 0) / mappedFields.length
      : 0

  // Add warnings
  if (overallConfidence < 0.7) {
    warnings.push('Low overall confidence in field detection. Manual review recommended.')
  }

  const lowConfidenceFields = mappedFields.filter((f) => f.confidence < 0.6)
  if (lowConfidenceFields.length > 0) {
    warnings.push(
      `${lowConfidenceFields.length} field(s) have low confidence and may need verification.`
    )
  }

  return {
    fields: mappedFields,
    suggestedFormName: enhancedResult.suggestedFormName,
    suggestedFormType: enhancedResult.suggestedFormType,
    sections,
    warnings,
    overallConfidence,
  }
}

/**
 * Use AI to enhance field detection
 */
async function enhanceFieldDetection(ocrResult: OcrResult): Promise<{
  fields: EnhancedField[]
  suggestedFormName: string
  suggestedFormType: string
}> {
  const client = getAnthropicClient()

  const prompt = `Analyze this form document text and identify all form fields. The text was extracted from a form document.

Document Text:
${ocrResult.text.slice(0, 8000)}

${ocrResult.structure.fields?.length ? `
Already detected fields:
${JSON.stringify(ocrResult.structure.fields.slice(0, 20), null, 2)}
` : ''}

Provide your response as JSON:
{
  "suggestedFormName": "Name for this form",
  "suggestedFormType": "INTAKE|FOLLOWUP|REFERRAL|ASSESSMENT|CUSTOM",
  "fields": [
    {
      "label": "Field label from document",
      "type": "text|number|date|phone|email|address|dropdown|checkbox|yes_no|signature|file",
      "purpose": "GRANT_REQUIREMENT|INTERNAL_OPS|COMPLIANCE|OUTCOME_MEASUREMENT|RISK_ASSESSMENT|OTHER",
      "isRequired": true,
      "isSensitive": false,
      "options": ["Option 1", "Option 2"],
      "section": "Section name if grouped",
      "helpText": "Helpful description if evident",
      "confidence": 0.9
    }
  ]
}

Guidelines:
- Identify ALL form fields, including empty ones
- Mark PII fields (SSN, DOB, address, phone) as sensitive
- Determine required fields from asterisks or "required" labels
- Group fields into sections if the form has clear sections
- For dropdowns/checkboxes, extract the available options
- Set appropriate purpose based on field context
- Be conservative with confidence scores

Return ONLY valid JSON.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse JSON response
    let jsonText = content.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }

    return JSON.parse(jsonText.trim())
  } catch (error) {
    console.error('AI field enhancement failed:', error)

    // Return basic structure from OCR results
    return {
      suggestedFormName: ocrResult.structure.title || 'Converted Form',
      suggestedFormType: 'CUSTOM',
      fields: (ocrResult.structure.fields || []).map((f) => ({
        label: f.label,
        type: f.type,
        purpose: 'OTHER',
        isRequired: f.isRequired || false,
        isSensitive: false,
        confidence: f.confidence,
      })),
    }
  }
}

interface EnhancedField {
  label: string
  type: string
  purpose: string
  isRequired: boolean
  isSensitive: boolean
  options?: string[]
  section?: string
  helpText?: string
  confidence: number
}

/**
 * Merge OCR-detected fields with AI-enhanced fields
 */
function mergeFieldDetections(
  ocrFields: DetectedFormElement[],
  aiFields: EnhancedField[]
): EnhancedField[] {
  // Create a map of OCR fields by label for quick lookup
  const ocrMap = new Map(ocrFields.map((f) => [normalizeLabel(f.label), f]))

  // Start with AI fields (usually more comprehensive)
  const merged: EnhancedField[] = []

  for (const aiField of aiFields) {
    const normalizedLabel = normalizeLabel(aiField.label)
    const ocrField = ocrMap.get(normalizedLabel)

    if (ocrField) {
      // Merge: prefer AI analysis but use OCR for position/value
      merged.push({
        ...aiField,
        confidence: Math.max(aiField.confidence, ocrField.confidence) * 0.95,
      })
      ocrMap.delete(normalizedLabel)
    } else {
      merged.push(aiField)
    }
  }

  // Add any OCR fields not found by AI
  for (const [, ocrField] of ocrMap) {
    merged.push({
      label: ocrField.label,
      type: ocrField.type,
      purpose: 'OTHER',
      isRequired: ocrField.isRequired || false,
      isSensitive: isSensitiveField(ocrField.label),
      confidence: ocrField.confidence * 0.8, // Lower confidence since AI didn't find it
    })
  }

  return merged
}

/**
 * Map enhanced field to Scrybe field definition
 */
function mapToScrybeField(field: EnhancedField, index: number): DetectedField {
  return {
    slug: generateSlug(field.label),
    name: field.label,
    type: mapFieldType(field.type),
    purpose: mapFieldPurpose(field.purpose),
    purposeNote: undefined,
    helpText: field.helpText,
    isRequired: field.isRequired,
    isSensitive: field.isSensitive || isSensitiveField(field.label),
    options: field.options,
    section: field.section,
    order: index,
    confidence: field.confidence,
    sourceLabel: field.label,
  }
}

/**
 * Map string type to Prisma FieldType
 */
function mapFieldType(type: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    text: 'TEXT_SHORT',
    text_field: 'TEXT_SHORT',
    string: 'TEXT_SHORT',
    textarea: 'TEXT_LONG',
    long_text: 'TEXT_LONG',
    number: 'NUMBER',
    numeric: 'NUMBER',
    integer: 'NUMBER',
    date: 'DATE',
    phone: 'PHONE',
    telephone: 'PHONE',
    email: 'EMAIL',
    address: 'ADDRESS',
    dropdown: 'DROPDOWN',
    select: 'DROPDOWN',
    checkbox: 'CHECKBOX',
    yes_no: 'YES_NO',
    boolean: 'YES_NO',
    signature: 'SIGNATURE',
    sign: 'SIGNATURE',
    file: 'FILE',
    upload: 'FILE',
    radio: 'DROPDOWN', // Map radio to dropdown with single select
  }
  return typeMap[type.toLowerCase()] || 'TEXT_SHORT'
}

/**
 * Map string purpose to Prisma FieldPurpose
 */
function mapFieldPurpose(purpose: string): FieldPurpose {
  const purposeMap: Record<string, FieldPurpose> = {
    grant_requirement: 'GRANT_REQUIREMENT',
    grant: 'GRANT_REQUIREMENT',
    internal_ops: 'INTERNAL_OPS',
    internal: 'INTERNAL_OPS',
    compliance: 'COMPLIANCE',
    outcome_measurement: 'OUTCOME_MEASUREMENT',
    outcome: 'OUTCOME_MEASUREMENT',
    risk_assessment: 'RISK_ASSESSMENT',
    risk: 'RISK_ASSESSMENT',
    other: 'OTHER',
  }
  return purposeMap[purpose.toLowerCase()] || 'OTHER'
}

/**
 * Generate a URL-safe slug from a label
 */
function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50) || `field_${Date.now()}`
}

/**
 * Normalize a label for comparison
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Check if a field is likely sensitive based on its label
 */
function isSensitiveField(label: string): boolean {
  const sensitivePatterns = [
    /ssn|social\s*security/i,
    /\bdob\b|date\s*of\s*birth|birth\s*date/i,
    /driver.*license|license\s*number/i,
    /passport/i,
    /bank\s*account|routing\s*number|account\s*number/i,
    /credit\s*card|card\s*number/i,
    /\bpin\b|password/i,
    /income|salary|wage/i,
    /medical|diagnosis|prescription|health\s*condition/i,
    /criminal|arrest|conviction/i,
    /immigration|visa\s*status|alien/i,
  ]

  return sensitivePatterns.some((pattern) => pattern.test(label))
}

/**
 * Validate detected fields for completeness
 */
export function validateDetectedFields(fields: DetectedField[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for duplicate slugs
  const slugs = fields.map((f) => f.slug)
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i)
  if (duplicates.length > 0) {
    errors.push(`Duplicate field slugs: ${[...new Set(duplicates)].join(', ')}`)
  }

  // Check for empty labels
  const emptyLabels = fields.filter((f) => !f.name.trim())
  if (emptyLabels.length > 0) {
    errors.push(`${emptyLabels.length} field(s) have empty labels`)
  }

  // Warn about low confidence fields
  const lowConfidence = fields.filter((f) => f.confidence < 0.6)
  if (lowConfidence.length > 0) {
    warnings.push(
      `${lowConfidence.length} field(s) have low confidence: ${lowConfidence.map((f) => f.name).join(', ')}`
    )
  }

  // Warn about potential PII
  const sensitiveFields = fields.filter((f) => f.isSensitive)
  if (sensitiveFields.length > 0) {
    warnings.push(
      `${sensitiveFields.length} field(s) may contain sensitive data: ${sensitiveFields.map((f) => f.name).join(', ')}`
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
