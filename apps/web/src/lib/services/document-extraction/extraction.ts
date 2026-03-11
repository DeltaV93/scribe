/**
 * Document Extraction - AI Field Extraction
 *
 * Uses Claude to extract form field values from OCR'd document text.
 * Maps extracted values to form field definitions with confidence scores.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractableFormField, ExtractedFieldValue } from './types'

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

/**
 * Extraction result from AI
 */
interface AIExtractionResponse {
  extractions: {
    fieldId: string
    fieldSlug: string
    value: string | number | boolean | string[] | null
    rawValue: string | null
    confidence: number
    reasoning: string
    sourceSnippet: string
  }[]
  overallConfidence: number
}

/**
 * Extract form field values from document text
 */
export async function extractFieldsFromText(
  documentText: string,
  fields: ExtractableFormField[],
  isScanned: boolean
): Promise<{
  fields: ExtractedFieldValue[]
  overallConfidence: number
  tokensUsed: { input: number; output: number }
}> {
  if (fields.length === 0) {
    return {
      fields: [],
      overallConfidence: 100,
      tokensUsed: { input: 0, output: 0 },
    }
  }

  const client = getAnthropicClient()

  // Build field descriptions for the prompt
  const fieldDescriptions = fields.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    type: f.type,
    helpText: f.helpText,
    required: f.isRequired,
    options: f.options?.map((o) => o.value),
  }))

  const systemPrompt = `You are a document data extraction specialist. Your task is to extract form field values from document text that was captured via OCR or photo.

IMPORTANT GUIDELINES:
1. Be accurate - only extract values you can clearly identify in the text
2. For unclear or ambiguous values, set lower confidence scores
3. For required fields with no value found, still include them with null value
4. Match dropdown/checkbox values to the provided options exactly when possible
5. For dates, normalize to ISO format (YYYY-MM-DD)
6. For phone numbers, extract digits only
7. For checkboxes with multiple options, return an array of selected values
8. For yes/no fields, return boolean true/false

Return your response as valid JSON only.`

  const userPrompt = `Extract values for the following form fields from this document text.

FORM FIELDS:
${JSON.stringify(fieldDescriptions, null, 2)}

DOCUMENT TEXT:
${documentText.slice(0, 12000)}

Return a JSON object with this exact structure:
{
  "extractions": [
    {
      "fieldId": "field-uuid",
      "fieldSlug": "field_slug",
      "value": "extracted value or null",
      "rawValue": "exact text from document or null",
      "confidence": 0.85,
      "reasoning": "Brief explanation of extraction",
      "sourceSnippet": "Relevant text snippet from document"
    }
  ],
  "overallConfidence": 0.8
}

Confidence scoring guidelines:
- 0.9-1.0: Clear, unambiguous match found
- 0.7-0.9: Good match with minor uncertainty
- 0.5-0.7: Partial match or interpretation needed
- 0.3-0.5: Uncertain, best guess
- 0.0-0.3: No relevant data found

Include ALL fields from the form, even if no value is found (with null value and low confidence).

Return ONLY valid JSON, no other text.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    // Parse the JSON response
    let parsed: AIExtractionResponse
    try {
      let jsonText = textContent.text.trim()
      // Handle markdown code blocks
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7)
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }
      parsed = JSON.parse(jsonText.trim())
    } catch {
      throw new Error('Failed to parse AI extraction response')
    }

    // Map to ExtractedFieldValue format
    const extractedFields: ExtractedFieldValue[] = parsed.extractions.map(
      (extraction) => {
        const field = fields.find((f) => f.id === extraction.fieldId)

        // Apply OCR penalty if document was scanned
        let confidence = extraction.confidence
        if (isScanned) {
          confidence *= 0.95 // Small penalty for OCR-based extraction
        }

        return {
          fieldId: extraction.fieldId,
          fieldSlug: extraction.fieldSlug,
          fieldName: field?.name || extraction.fieldSlug,
          fieldType: field?.type || 'TEXT_SHORT',
          value: extraction.value,
          rawValue: extraction.rawValue,
          confidence: Math.min(1, Math.max(0, confidence)),
          reasoning: extraction.reasoning,
          sourceSnippet: extraction.sourceSnippet,
          needsReview: confidence < 0.7,
          validationErrors: [],
        }
      }
    )

    // Add any missing fields
    for (const field of fields) {
      if (!extractedFields.find((e) => e.fieldId === field.id)) {
        extractedFields.push({
          fieldId: field.id,
          fieldSlug: field.slug,
          fieldName: field.name,
          fieldType: field.type,
          value: null,
          rawValue: null,
          confidence: 0,
          reasoning: 'Field not found in document',
          sourceSnippet: undefined,
          needsReview: true,
          validationErrors: field.isRequired ? ['Required field not found'] : [],
        })
      }
    }

    // Calculate overall confidence
    const overallConfidence =
      extractedFields.length > 0
        ? extractedFields.reduce((sum, f) => sum + f.confidence, 0) /
          extractedFields.length
        : 0

    return {
      fields: extractedFields,
      overallConfidence: parsed.overallConfidence || overallConfidence,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    }
  } catch (error) {
    console.error('Field extraction error:', error)
    throw error
  }
}

/**
 * Re-extract a specific field with additional context
 */
export async function reExtractField(
  documentText: string,
  field: ExtractableFormField,
  additionalContext?: string
): Promise<ExtractedFieldValue> {
  const client = getAnthropicClient()

  const prompt = `Extract the value for this form field from the document text.

FIELD:
- Name: ${field.name}
- Type: ${field.type}
- Help Text: ${field.helpText || 'None'}
- Required: ${field.isRequired}
${field.options ? `- Options: ${field.options.map((o) => o.value).join(', ')}` : ''}

${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

DOCUMENT TEXT:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "extracted value or null",
  "rawValue": "exact text from document or null",
  "confidence": 0.85,
  "reasoning": "explanation",
  "sourceSnippet": "relevant text"
}

Return ONLY valid JSON.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    let jsonText = textContent.text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonText)

    return {
      fieldId: field.id,
      fieldSlug: field.slug,
      fieldName: field.name,
      fieldType: field.type,
      value: parsed.value,
      rawValue: parsed.rawValue,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      sourceSnippet: parsed.sourceSnippet,
      needsReview: parsed.confidence < 0.7,
      validationErrors: [],
    }
  } catch (error) {
    console.error('Re-extraction error:', error)
    return {
      fieldId: field.id,
      fieldSlug: field.slug,
      fieldName: field.name,
      fieldType: field.type,
      value: null,
      rawValue: null,
      confidence: 0,
      reasoning: 'Extraction failed',
      sourceSnippet: undefined,
      needsReview: true,
      validationErrors: ['Extraction failed'],
    }
  }
}
