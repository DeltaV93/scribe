import { anthropic, EXTRACTION_MODEL } from "./client";
import { generateSystemPrompt, generateExtractionPrompt } from "./prompts";
import type {
  ExtractableField,
  ExtractionResult,
  FieldExtractionResult,
  ExtractionExample,
  PromptOptions,
} from "./types";

/**
 * Extract form field values from source text using Claude
 */
export async function extractFormData(
  fields: ExtractableField[],
  sourceText: string,
  examples?: Map<string, ExtractionExample[]>,
  options: PromptOptions = {}
): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Filter to only AI-extractable fields
  const extractableFields = fields.filter((f) => f.id); // All fields passed should be extractable

  if (extractableFields.length === 0) {
    return {
      success: true,
      fields: [],
      overallConfidence: 100,
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: 0,
    };
  }

  try {
    const systemPrompt = generateSystemPrompt();
    const userPrompt = generateExtractionPrompt(
      extractableFields,
      sourceText,
      examples,
      options
    );

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
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
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      extractions: FieldExtractionResult[];
      overallConfidence: number;
    };

    // Validate and normalize the extractions
    const normalizedFields = parsed.extractions.map((extraction) => ({
      fieldId: extraction.fieldId,
      slug: extraction.slug,
      value: extraction.value,
      confidence: Math.min(100, Math.max(0, extraction.confidence)),
      reasoning: extraction.reasoning,
      sourceSnippet: extraction.sourceSnippet,
      needsReview: extraction.needsReview || extraction.confidence < 70,
    }));

    return {
      success: true,
      fields: normalizedFields,
      overallConfidence: parsed.overallConfidence,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Extraction error:", error);
    return {
      success: false,
      fields: [],
      overallConfidence: 0,
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Validate extracted values against field constraints
 */
export function validateExtraction(
  field: ExtractableField,
  extraction: FieldExtractionResult
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check required fields
  if (
    field.isRequired &&
    (extraction.value === null || extraction.value === "")
  ) {
    issues.push("Required field is missing a value");
  }

  // Validate dropdown/checkbox values
  if (
    field.options &&
    field.options.length > 0 &&
    extraction.value !== null
  ) {
    const validValues = field.options.map((o) => o.value);

    if (Array.isArray(extraction.value)) {
      // Checkbox - multiple values
      const invalidValues = extraction.value.filter(
        (v) => !validValues.includes(String(v))
      );
      if (invalidValues.length > 0) {
        issues.push(`Invalid options selected: ${invalidValues.join(", ")}`);
      }
    } else {
      // Dropdown - single value
      if (!validValues.includes(String(extraction.value))) {
        issues.push(
          `Value "${extraction.value}" is not a valid option. Valid options: ${validValues.join(", ")}`
        );
      }
    }
  }

  // Type-specific validation
  switch (field.type) {
    case "EMAIL":
      if (
        extraction.value &&
        typeof extraction.value === "string" &&
        !extraction.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      ) {
        issues.push("Invalid email format");
      }
      break;
    case "PHONE":
      if (
        extraction.value &&
        typeof extraction.value === "string" &&
        !extraction.value.match(/^[\d\s\-\+\(\)\.]+$/)
      ) {
        issues.push("Invalid phone number format");
      }
      break;
    case "DATE":
      if (
        extraction.value &&
        typeof extraction.value === "string" &&
        isNaN(Date.parse(extraction.value))
      ) {
        issues.push("Invalid date format");
      }
      break;
    case "NUMBER":
      if (
        extraction.value !== null &&
        typeof extraction.value !== "number" &&
        isNaN(Number(extraction.value))
      ) {
        issues.push("Value is not a valid number");
      }
      break;
    case "YES_NO":
      if (
        extraction.value !== null &&
        typeof extraction.value !== "boolean" &&
        !["true", "false", "yes", "no"].includes(
          String(extraction.value).toLowerCase()
        )
      ) {
        issues.push("Value must be yes/no or true/false");
      }
      break;
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Post-process extraction results to normalize values
 */
export function normalizeExtractionValue(
  field: ExtractableField,
  value: string | number | boolean | string[] | null
): string | number | boolean | string[] | null {
  if (value === null) return null;

  switch (field.type) {
    case "YES_NO":
      if (typeof value === "boolean") return value;
      const strVal = String(value).toLowerCase();
      return ["yes", "true", "1"].includes(strVal);

    case "NUMBER":
      if (typeof value === "number") return value;
      const num = Number(value);
      return isNaN(num) ? null : num;

    case "DATE":
      if (typeof value !== "string") return null;
      // Try to parse and format as ISO date
      const date = new Date(value);
      if (isNaN(date.getTime())) return value; // Return original if parse fails
      return date.toISOString().split("T")[0];

    case "CHECKBOX":
      // Ensure array format
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        return value.split(",").map((v) => v.trim());
      }
      return [String(value)];

    default:
      return value;
  }
}

/**
 * Calculate overall confidence from individual field extractions
 */
export function calculateOverallConfidence(
  extractions: FieldExtractionResult[],
  fields: ExtractableField[]
): number {
  if (extractions.length === 0) return 100;

  // Weight required fields more heavily
  let totalWeight = 0;
  let weightedSum = 0;

  for (const extraction of extractions) {
    const field = fields.find((f) => f.id === extraction.fieldId);
    const weight = field?.isRequired ? 2 : 1;
    totalWeight += weight;
    weightedSum += extraction.confidence * weight;
  }

  return Math.round(weightedSum / totalWeight);
}
