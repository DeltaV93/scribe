import type { ExtractableField, ExtractionExample, PromptOptions } from "./types";
import { FIELD_TYPE_CONFIG, type FieldType } from "@/types";

/**
 * Generate the system prompt for extraction
 */
export function generateSystemPrompt(): string {
  return `You are an expert data extraction assistant for a case management system. Your task is to extract structured information from call transcripts, documents, or other text sources and map them to specific form fields.

IMPORTANT GUIDELINES:
1. Extract ONLY information that is explicitly stated or clearly implied in the source text
2. Do NOT infer, assume, or make up information that isn't present
3. For each field, provide a confidence score (0-100) based on how certain you are about the extraction
4. Flag fields for human review when confidence is below 70% or when the information is ambiguous
5. Preserve the original format of phone numbers, dates, and addresses as closely as possible
6. For dropdown/checkbox fields, only use values from the provided options list
7. If information for a required field is missing, mark it as needing review

OUTPUT FORMAT:
You must respond with valid JSON in this exact format:
{
  "extractions": [
    {
      "fieldId": "field-uuid",
      "slug": "field_slug",
      "value": "extracted value or null",
      "confidence": 85,
      "reasoning": "Brief explanation of why this value was extracted",
      "sourceSnippet": "The relevant quote from the source",
      "needsReview": false
    }
  ],
  "overallConfidence": 82
}`;
}

/**
 * Generate field descriptions for the extraction prompt
 */
export function generateFieldDescriptions(fields: ExtractableField[]): string {
  return fields
    .map((field) => {
      const config = FIELD_TYPE_CONFIG[field.type as FieldType];
      let description = `- **${field.name}** (ID: ${field.id}, slug: ${field.slug})
  Type: ${config.label}
  Purpose: ${field.purpose}${field.helpText ? `\n  Description: ${field.helpText}` : ""}
  Required: ${field.isRequired ? "Yes" : "No"}`;

      // Add options for dropdown/checkbox fields
      if (field.options && field.options.length > 0) {
        const optionsList = field.options
          .map((opt) => `"${opt.value}" (${opt.label})`)
          .join(", ");
        description += `\n  Valid Options: ${optionsList}`;
      }

      // Add type-specific guidance
      switch (field.type) {
        case "DATE":
          description += `\n  Format: YYYY-MM-DD`;
          break;
        case "PHONE":
          description += `\n  Format: Include country code if mentioned, e.g., +1-555-123-4567`;
          break;
        case "EMAIL":
          description += `\n  Format: Standard email format`;
          break;
        case "YES_NO":
          description += `\n  Valid Values: true or false`;
          break;
        case "NUMBER":
          description += `\n  Format: Numeric value only (no units)`;
          break;
      }

      return description;
    })
    .join("\n\n");
}

/**
 * Generate few-shot examples for a field
 */
export function generateExamplesSection(
  fieldExamples: Map<string, ExtractionExample[]>,
  maxPerField: number = 3
): string {
  if (fieldExamples.size === 0) {
    return "";
  }

  let examples = "\n\n## EXAMPLES FROM PREVIOUS EXTRACTIONS\n\n";
  examples +=
    "Here are examples of successful extractions for similar fields:\n\n";

  for (const [fieldId, fieldExs] of fieldExamples) {
    const limitedExamples = fieldExs.slice(0, maxPerField);
    for (const ex of limitedExamples) {
      examples += `**Example for field ${fieldId}:**
Source text: "${ex.transcriptSnippet}"
Extracted value: "${ex.extractedValue}"

`;
    }
  }

  return examples;
}

/**
 * Generate the full extraction prompt
 */
export function generateExtractionPrompt(
  fields: ExtractableField[],
  sourceText: string,
  examples?: Map<string, ExtractionExample[]>,
  options: PromptOptions = {}
): string {
  const { includeExamples = true, maxExamplesPerField = 3, strictMode = true } = options;

  let prompt = `## FIELDS TO EXTRACT

${generateFieldDescriptions(fields)}`;

  // Add examples if available
  if (includeExamples && examples && examples.size > 0) {
    prompt += generateExamplesSection(examples, maxExamplesPerField);
  }

  // Add strict mode instructions
  if (strictMode) {
    prompt += `\n\n## STRICT MODE ENABLED
For dropdown and checkbox fields, you MUST only use values from the provided options list. If the source text mentions something similar but not exactly matching an option, choose the closest match and lower your confidence score.`;
  }

  // Add the source text
  prompt += `\n\n## SOURCE TEXT TO EXTRACT FROM

"""
${sourceText}
"""

## INSTRUCTIONS

Extract information for each field listed above from the source text. For each field:
1. Find the relevant information in the source text
2. Extract and format the value according to the field type
3. Assess your confidence in the extraction
4. Note if human review is needed

Respond with valid JSON only, no additional text.`;

  return prompt;
}

/**
 * Generate a prompt for extracting from a specific document type
 */
export function generateDocumentExtractionPrompt(
  fields: ExtractableField[],
  documentType: "transcript" | "pdf" | "email" | "notes",
  sourceText: string,
  examples?: Map<string, ExtractionExample[]>
): string {
  const documentGuidance: Record<string, string> = {
    transcript: `This is a call transcript between a caller and an agent. Look for:
- Information volunteered by the caller
- Responses to agent questions
- Corrections or clarifications made during the call
- Spelled-out names, addresses, or phone numbers`,
    pdf: `This is extracted text from a PDF document. Be aware that:
- Formatting may be lost or inconsistent
- Tables may appear as disconnected text
- Headers and footers may be mixed with content`,
    email: `This is an email message. Pay attention to:
- The email body for main information
- Signatures for contact details
- Subject line for context`,
    notes: `These are case notes or manual entries. Note that:
- Information may be abbreviated
- Multiple entries may be present
- Dates and context may vary`,
  };

  let prompt = `## DOCUMENT TYPE: ${documentType.toUpperCase()}

${documentGuidance[documentType]}

`;

  prompt += generateExtractionPrompt(fields, sourceText, examples);

  return prompt;
}
