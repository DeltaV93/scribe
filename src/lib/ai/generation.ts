// Core logic for AI-powered form generation

import { anthropic, EXTRACTION_MODEL } from "./client";
import {
  FORM_GENERATION_SYSTEM_PROMPT,
  buildGenerationPrompt,
} from "./generation-prompts";
import type {
  GenerateFormRequest,
  GenerateFormResponse,
  GeneratedFieldData,
  ExtractionSuggestion,
  ClaudeGenerationResponse,
} from "./generation-types";
import { FieldType, FieldPurpose } from "@/types";

/**
 * Generate form fields from user requirements using Claude
 */
export async function generateFormFields(
  request: GenerateFormRequest
): Promise<GenerateFormResponse> {
  try {
    const userPrompt = buildGenerationPrompt(request);

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 8192,
      system: FORM_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // Parse the JSON response
    const parsed = parseGeneratedForm(textContent.text);

    // Transform and validate fields
    const fields = transformFields(parsed.fields);
    const extractionSuggestions = validateExtractionSuggestions(
      parsed.extractionSuggestions,
      fields
    );

    return {
      success: true,
      fields,
      extractionSuggestions,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error("Form generation error:", error);
    return {
      success: false,
      fields: [],
      extractionSuggestions: [],
      reasoning: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Parse Claude's JSON response
 */
export function parseGeneratedForm(responseText: string): ClaudeGenerationResponse {
  // Try to find JSON in the response
  let jsonStr = responseText.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Try to extract JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON in response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required structure
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      throw new Error("Response missing 'fields' array");
    }
    if (!parsed.reasoning || typeof parsed.reasoning !== "string") {
      throw new Error("Response missing 'reasoning' string");
    }

    // Ensure extractionSuggestions exists
    if (!parsed.extractionSuggestions) {
      parsed.extractionSuggestions = [];
    }

    // Validate each field has required properties
    parsed.fields = parsed.fields.filter((field: Record<string, unknown>) => {
      if (!field || typeof field !== "object") {
        console.warn("Skipping invalid field (not an object):", field);
        return false;
      }
      if (!field.name || typeof field.name !== "string") {
        console.warn("Skipping field with missing/invalid name:", field);
        return false;
      }
      return true;
    });

    return parsed as ClaudeGenerationResponse;
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      throw new Error(`Invalid JSON in response: ${parseError.message}`);
    }
    throw parseError;
  }
}

/**
 * Transform raw Claude response fields into validated GeneratedFieldData
 */
function transformFields(
  rawFields: ClaudeGenerationResponse["fields"]
): GeneratedFieldData[] {
  return rawFields.map((field, index) => {
    // Validate and coerce field type
    const validatedType = validateFieldType(field.type);
    const validatedPurpose = validateFieldPurpose(field.purpose);

    return {
      id: crypto.randomUUID(),
      name: field.name || `Field ${index + 1}`,
      slug: field.slug || generateSlug(field.name || `field_${index + 1}`),
      type: validatedType,
      purpose: validatedPurpose,
      purposeNote: field.purposeNote || undefined,
      helpText: field.helpText || undefined,
      isRequired: Boolean(field.isRequired),
      isSensitive: Boolean(field.isSensitive),
      isAiExtractable: validatedType !== "SIGNATURE" && Boolean(field.isAiExtractable),
      options: field.options?.map((opt) => ({
        label: opt.label || "",
        value: opt.value || generateSlug(opt.label || "option"),
      })),
      section: field.section || undefined,
      order: typeof field.order === "number" ? field.order : index,
      reasoning: field.reasoning || "No reasoning provided",
    };
  });
}

/**
 * Validate field type against allowed values
 */
function validateFieldType(type: string): FieldType {
  const validTypes = Object.values(FieldType);
  const upperType = type?.toUpperCase();

  if (validTypes.includes(upperType as FieldType)) {
    return upperType as FieldType;
  }

  // Default to TEXT_SHORT for unknown types
  console.warn(`Unknown field type "${type}", defaulting to TEXT_SHORT`);
  return FieldType.TEXT_SHORT;
}

/**
 * Validate field purpose against allowed values
 */
function validateFieldPurpose(purpose: string): FieldPurpose {
  const validPurposes = Object.values(FieldPurpose);
  const upperPurpose = purpose?.toUpperCase();

  if (validPurposes.includes(upperPurpose as FieldPurpose)) {
    return upperPurpose as FieldPurpose;
  }

  // Default to INTERNAL_OPS for unknown purposes
  console.warn(`Unknown field purpose "${purpose}", defaulting to INTERNAL_OPS`);
  return FieldPurpose.INTERNAL_OPS;
}

/**
 * Validate extraction suggestions match generated fields
 */
function validateExtractionSuggestions(
  suggestions: ClaudeGenerationResponse["extractionSuggestions"],
  fields: GeneratedFieldData[]
): ExtractionSuggestion[] {
  const fieldSlugs = new Set(fields.map((f) => f.slug));

  return suggestions
    .filter((s) => fieldSlugs.has(s.fieldSlug))
    .map((s) => ({
      fieldSlug: s.fieldSlug,
      extractionHint: s.extractionHint || "",
      expectedFormat: s.expectedFormat || "",
      exampleValues: Array.isArray(s.exampleValues) ? s.exampleValues : [],
    }));
}

/**
 * Generate a slug from a field name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Group fields by section for display
 */
export function groupFieldsBySection(
  fields: GeneratedFieldData[]
): Map<string, GeneratedFieldData[]> {
  const groups = new Map<string, GeneratedFieldData[]>();

  for (const field of fields) {
    const section = field.section || "Other";
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)!.push(field);
  }

  // Sort fields within each section by order
  for (const [section, sectionFields] of groups) {
    groups.set(
      section,
      sectionFields.sort((a, b) => a.order - b.order)
    );
  }

  return groups;
}

/**
 * Calculate summary statistics for generated fields
 */
export function getFieldSummary(fields: GeneratedFieldData[]): {
  total: number;
  required: number;
  sensitive: number;
  aiExtractable: number;
  sections: string[];
} {
  return {
    total: fields.length,
    required: fields.filter((f) => f.isRequired).length,
    sensitive: fields.filter((f) => f.isSensitive).length,
    aiExtractable: fields.filter((f) => f.isAiExtractable).length,
    sections: [...new Set(fields.map((f) => f.section).filter(Boolean) as string[])],
  };
}
