/**
 * AI Field Mapper Service
 *
 * Uses Claude to intelligently map import file columns to Scrybe fields.
 */

import { anthropic, FAST_MODEL } from "@/lib/ai/client";
import {
  ImportFieldMapping,
  AIMappingRequest,
  AIMappingResponse,
  TargetFieldDefinition,
  SCRYBE_CLIENT_FIELDS,
  FieldMappingSuggestion,
} from "./types";
import { analyzeColumns } from "./file-parser";

// ============================================
// AI MAPPING
// ============================================

/**
 * Generate AI-powered field mapping suggestions
 */
export async function generateAIMappings(
  request: AIMappingRequest
): Promise<AIMappingResponse> {
  const { columns, sampleData, targetFields, sourceSystem } = request;

  // Analyze columns to provide context
  const columnAnalysis = analyzeColumns(sampleData);

  // Build the prompt
  const prompt = buildMappingPrompt(columns, columnAnalysis, targetFields, sourceSystem);

  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse the response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return parseAIResponse(content.text, columns, targetFields);
  } catch (error) {
    console.error("AI mapping failed:", error);
    // Fall back to rule-based mapping
    return generateRuleBasedMappings(columns, columnAnalysis, targetFields);
  }
}

/**
 * Build the prompt for field mapping
 */
function buildMappingPrompt(
  columns: string[],
  columnAnalysis: Record<string, { sampleValues: string[]; inferredType: string }>,
  targetFields: TargetFieldDefinition[],
  sourceSystem?: string
): string {
  const targetFieldsDescription = targetFields
    .map((f) => `- ${f.path}: ${f.label} (${f.type}${f.required ? ", required" : ""})`)
    .join("\n");

  const columnInfo = columns
    .map((col) => {
      const analysis = columnAnalysis[col];
      const samples = analysis?.sampleValues?.slice(0, 3).join(", ") || "";
      const type = analysis?.inferredType || "string";
      return `- "${col}" [${type}]: samples: ${samples}`;
    })
    .join("\n");

  return `You are a data mapping expert. Map import file columns to target database fields.

${sourceSystem ? `Source System: ${sourceSystem}` : ""}

**Import File Columns:**
${columnInfo}

**Target Fields:**
${targetFieldsDescription}

**Instructions:**
1. Match each import column to the most appropriate target field
2. Consider column names, sample values, and data types
3. If no good match exists, leave the column unmapped
4. For each mapping, provide a confidence score (0-1)

**Response Format (JSON):**
{
  "mappings": [
    {
      "sourceColumn": "column_name",
      "targetField": "target.path",
      "confidence": 0.95,
      "reason": "brief explanation"
    }
  ],
  "unmappedColumns": ["col1", "col2"],
  "notes": ["any additional notes"]
}

Only output valid JSON, no other text.`;
}

/**
 * Parse the AI response into structured mappings
 */
function parseAIResponse(
  responseText: string,
  columns: string[],
  targetFields: TargetFieldDefinition[]
): AIMappingResponse {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    const mappings: ImportFieldMapping[] = (parsed.mappings || []).map(
      (m: { sourceColumn: string; targetField: string; confidence?: number }) => ({
        sourceColumn: m.sourceColumn,
        targetField: m.targetField,
        confidence: m.confidence || 0.5,
        aiSuggested: true,
      })
    );

    // Validate target fields exist
    const validTargetPaths = new Set(targetFields.map((f) => f.path));
    const validMappings = mappings.filter((m) => validTargetPaths.has(m.targetField));

    const mappedColumns = new Set(validMappings.map((m) => m.sourceColumn));
    const unmappedColumns = columns.filter((c) => !mappedColumns.has(c));

    // Calculate overall confidence
    const avgConfidence =
      validMappings.length > 0
        ? validMappings.reduce((sum, m) => sum + (m.confidence || 0), 0) / validMappings.length
        : 0;

    return {
      mappings: validMappings,
      unmappedColumns,
      confidence: avgConfidence,
      notes: parsed.notes || [],
    };
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return {
      mappings: [],
      unmappedColumns: columns,
      confidence: 0,
      notes: ["AI response parsing failed, using rule-based fallback"],
    };
  }
}

// ============================================
// RULE-BASED MAPPING (FALLBACK)
// ============================================

/**
 * Generate mappings using rules when AI is unavailable
 */
function generateRuleBasedMappings(
  columns: string[],
  columnAnalysis: Record<string, { sampleValues: string[]; inferredType: string }>,
  targetFields: TargetFieldDefinition[]
): AIMappingResponse {
  const mappings: ImportFieldMapping[] = [];
  const unmappedColumns: string[] = [];

  // Common column name patterns
  const patterns: Record<string, string[]> = {
    "client.firstName": ["first_name", "firstname", "first", "fname", "given_name"],
    "client.lastName": ["last_name", "lastname", "last", "lname", "surname", "family_name"],
    "client.phone": ["phone", "telephone", "mobile", "cell", "phone_number", "contact_phone"],
    "client.email": ["email", "email_address", "e_mail", "e-mail"],
    "client.address.street": ["street", "address", "address1", "street_address", "address_line_1"],
    "client.address.city": ["city", "town"],
    "client.address.state": ["state", "province", "region"],
    "client.address.zip": ["zip", "zipcode", "zip_code", "postal", "postal_code", "postcode"],
    "client.internalId": ["id", "client_id", "participant_id", "external_id", "internal_id"],
  };

  for (const column of columns) {
    const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, "_");
    let matched = false;

    for (const [targetPath, aliases] of Object.entries(patterns)) {
      if (aliases.some((alias) => normalizedColumn.includes(alias))) {
        // Check if target field exists
        const targetField = targetFields.find((f) => f.path === targetPath);
        if (targetField) {
          mappings.push({
            sourceColumn: column,
            targetField: targetPath,
            confidence: 0.7,
            aiSuggested: false,
          });
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      unmappedColumns.push(column);
    }
  }

  return {
    mappings,
    unmappedColumns,
    confidence: mappings.length / columns.length,
    notes: ["Using rule-based mapping (AI unavailable)"],
  };
}

// ============================================
// MAPPING SUGGESTIONS
// ============================================

/**
 * Get mapping suggestions for each unmapped column
 */
export async function getMappingSuggestions(
  columns: string[],
  sampleData: Record<string, unknown>[],
  targetFields: TargetFieldDefinition[] = SCRYBE_CLIENT_FIELDS
): Promise<FieldMappingSuggestion[]> {
  const columnAnalysis = analyzeColumns(sampleData);

  return columns.map((column) => {
    const analysis = columnAnalysis[column];
    const suggestions = getSuggestionsForColumn(column, analysis, targetFields);

    return {
      sourceColumn: column,
      suggestions,
      sampleValues: analysis?.sampleValues || [],
    };
  });
}

/**
 * Get suggestions for a single column
 */
function getSuggestionsForColumn(
  column: string,
  analysis: { sampleValues: string[]; inferredType: string } | undefined,
  targetFields: TargetFieldDefinition[]
): Array<{ targetField: string; confidence: number; reason: string }> {
  const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const suggestions: Array<{ targetField: string; confidence: number; reason: string }> = [];

  for (const target of targetFields) {
    let confidence = 0;
    const reasons: string[] = [];

    // Check name similarity
    const targetNormalized = target.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const targetPathNormalized = target.path.split(".").pop()?.toLowerCase() || "";

    if (normalizedColumn === targetNormalized || normalizedColumn === targetPathNormalized) {
      confidence += 0.5;
      reasons.push("Exact name match");
    } else if (
      normalizedColumn.includes(targetNormalized) ||
      targetNormalized.includes(normalizedColumn)
    ) {
      confidence += 0.3;
      reasons.push("Partial name match");
    }

    // Check type compatibility
    if (analysis?.inferredType === target.type) {
      confidence += 0.2;
      reasons.push("Type match");
    }

    // Add common abbreviation matches
    const abbreviations: Record<string, string[]> = {
      phone: ["tel", "ph", "cell", "mobile"],
      email: ["mail", "e-mail"],
      firstName: ["fname", "first", "given"],
      lastName: ["lname", "last", "surname"],
      address: ["addr", "street", "line1"],
      city: ["town", "municipality"],
      state: ["st", "province", "region"],
      zip: ["postal", "postcode", "zipcode"],
    };

    const targetKey = target.path.split(".").pop() || "";
    const abbrevs = abbreviations[targetKey] || [];
    if (abbrevs.some((a) => normalizedColumn.includes(a))) {
      confidence += 0.2;
      reasons.push("Abbreviation match");
    }

    if (confidence > 0.2) {
      suggestions.push({
        targetField: target.path,
        confidence: Math.min(confidence, 1),
        reason: reasons.join(", "),
      });
    }
  }

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions.slice(0, 3);
}

// ============================================
// FIELD TRANSFORMATION
// ============================================

/**
 * Apply field transformations during import
 */
export function transformValue(
  value: unknown,
  transformer?: string
): unknown {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (!transformer) {
    return value;
  }

  const [type, format] = transformer.split(":");

  switch (type) {
    case "date":
      return transformDate(String(value), format);
    case "phone":
      return transformPhone(String(value));
    case "ssn":
      return transformSSN(String(value));
    case "uppercase":
      return String(value).toUpperCase();
    case "lowercase":
      return String(value).toLowerCase();
    case "trim":
      return String(value).trim();
    case "number":
      return parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    default:
      return value;
  }
}

function transformDate(value: string, format?: string): string {
  // Try to parse common date formats
  const patterns = [
    { pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/, parts: [3, 1, 2] }, // MM/DD/YYYY
    { pattern: /^(\d{2})-(\d{2})-(\d{4})$/, parts: [3, 2, 1] },   // DD-MM-YYYY
    { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, parts: [1, 2, 3] },   // YYYY-MM-DD (ISO)
  ];

  for (const { pattern, parts } of patterns) {
    const match = value.match(pattern);
    if (match) {
      const [, g1, g2, g3] = match;
      const groups = [g1, g2, g3];
      const year = groups[parts[0] - 1];
      const month = groups[parts[1] - 1];
      const day = groups[parts[2] - 1];
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  // Try Date.parse as fallback
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }

  return value;
}

function transformPhone(value: string): string {
  // Strip all non-numeric characters
  const digits = value.replace(/\D/g, "");

  // Remove leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

function transformSSN(value: string): string {
  // Strip all non-numeric characters
  return value.replace(/\D/g, "");
}
