import { anthropic, EXTRACTION_MODEL } from "./client";
import type { TranscriptSegment } from "@/lib/deepgram/transcribe";
import type { ExtractableField, FieldExtractionResult } from "./types";

// Field domains for grouped extraction
export type FieldDomain =
  | "demographics"
  | "contact"
  | "case_details"
  | "medical"
  | "financial"
  | "other";

interface GroupedFields {
  domain: FieldDomain;
  fields: ExtractableField[];
}

interface CallExtractionResult {
  success: boolean;
  fields: FieldExtractionResult[];
  conflicts: FieldConflict[];
  overallConfidence: number;
  tokensUsed: { input: number; output: number };
  processingTimeMs: number;
  error?: string;
}

interface FieldConflict {
  fieldId: string;
  slug: string;
  values: Array<{
    value: string;
    context: string;
    timestamp?: number;
    confidence: number;
  }>;
}

/**
 * Group fields by domain for more focused extraction
 */
export function groupFieldsByDomain(
  fields: ExtractableField[]
): GroupedFields[] {
  const domainMap: Record<FieldDomain, ExtractableField[]> = {
    demographics: [],
    contact: [],
    case_details: [],
    medical: [],
    financial: [],
    other: [],
  };

  // Classify fields by slug patterns
  for (const field of fields) {
    const slug = field.slug.toLowerCase();

    if (
      slug.includes("name") ||
      slug.includes("dob") ||
      slug.includes("birth") ||
      slug.includes("age") ||
      slug.includes("gender") ||
      slug.includes("ssn") ||
      slug.includes("social")
    ) {
      domainMap.demographics.push(field);
    } else if (
      slug.includes("phone") ||
      slug.includes("email") ||
      slug.includes("address") ||
      slug.includes("city") ||
      slug.includes("state") ||
      slug.includes("zip") ||
      slug.includes("contact")
    ) {
      domainMap.contact.push(field);
    } else if (
      slug.includes("diagnosis") ||
      slug.includes("medication") ||
      slug.includes("treatment") ||
      slug.includes("doctor") ||
      slug.includes("medical") ||
      slug.includes("health") ||
      slug.includes("condition")
    ) {
      domainMap.medical.push(field);
    } else if (
      slug.includes("income") ||
      slug.includes("salary") ||
      slug.includes("employment") ||
      slug.includes("employer") ||
      slug.includes("insurance") ||
      slug.includes("benefit")
    ) {
      domainMap.financial.push(field);
    } else if (
      slug.includes("case") ||
      slug.includes("reason") ||
      slug.includes("referral") ||
      slug.includes("need") ||
      slug.includes("service")
    ) {
      domainMap.case_details.push(field);
    } else {
      domainMap.other.push(field);
    }
  }

  // Return non-empty groups
  return Object.entries(domainMap)
    .filter(([_, fields]) => fields.length > 0)
    .map(([domain, fields]) => ({
      domain: domain as FieldDomain,
      fields,
    }));
}

/**
 * Extract fields from call transcript using domain-grouped approach
 */
export async function extractFromCallTranscript(
  transcript: TranscriptSegment[],
  fields: ExtractableField[]
): Promise<CallExtractionResult> {
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Format transcript for extraction
  const formattedTranscript = formatTranscriptForExtraction(transcript);

  // Group fields by domain
  const groupedFields = groupFieldsByDomain(fields);

  const allResults: FieldExtractionResult[] = [];
  const allConflicts: FieldConflict[] = [];

  // Extract each domain group
  for (const group of groupedFields) {
    try {
      const { fields: extractedFields, conflicts, tokensUsed } =
        await extractFieldGroup(formattedTranscript, group.domain, group.fields);

      allResults.push(...extractedFields);
      allConflicts.push(...conflicts);
      totalInputTokens += tokensUsed.input;
      totalOutputTokens += tokensUsed.output;
    } catch (error) {
      console.error(`Error extracting ${group.domain} fields:`, error);
      // Continue with other groups
    }
  }

  // Calculate overall confidence
  const confidences = allResults.map((r) => r.confidence);
  const overallConfidence =
    confidences.length > 0
      ? Math.round(
          confidences.reduce((a, b) => a + b, 0) / confidences.length
        )
      : 0;

  return {
    success: true,
    fields: allResults,
    conflicts: allConflicts,
    overallConfidence,
    tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Format transcript segments for extraction prompts
 */
function formatTranscriptForExtraction(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const speaker =
        s.speaker === "CASE_MANAGER"
          ? "Case Manager"
          : s.speaker === "CLIENT"
            ? "Client"
            : "Unknown";
      const timestamp = formatTimestamp(s.startTime);
      return `[${timestamp}] ${speaker}: ${s.text}`;
    })
    .join("\n");
}

/**
 * Format seconds to mm:ss
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Extract a group of fields from transcript
 */
async function extractFieldGroup(
  transcript: string,
  domain: FieldDomain,
  fields: ExtractableField[]
): Promise<{
  fields: FieldExtractionResult[];
  conflicts: FieldConflict[];
  tokensUsed: { input: number; output: number };
}> {
  const systemPrompt = generateDomainSystemPrompt(domain);
  const userPrompt = generateDomainUserPrompt(transcript, fields);

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON in response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    extractions: Array<{
      fieldId: string;
      slug: string;
      value: string | null;
      confidence: number;
      reasoning: string;
      sourceSnippet: string;
      conflictingValues?: Array<{
        value: string;
        context: string;
        confidence: number;
      }>;
    }>;
  };

  const extractedFields: FieldExtractionResult[] = [];
  const conflicts: FieldConflict[] = [];

  for (const extraction of parsed.extractions) {
    extractedFields.push({
      fieldId: extraction.fieldId,
      slug: extraction.slug,
      value: extraction.value,
      confidence: Math.min(100, Math.max(0, extraction.confidence)),
      reasoning: extraction.reasoning,
      sourceSnippet: extraction.sourceSnippet,
      needsReview: extraction.confidence < 70 || !!extraction.conflictingValues,
    });

    if (extraction.conflictingValues && extraction.conflictingValues.length > 0) {
      conflicts.push({
        fieldId: extraction.fieldId,
        slug: extraction.slug,
        values: extraction.conflictingValues,
      });
    }
  }

  return {
    fields: extractedFields,
    conflicts,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

/**
 * Generate system prompt for domain-specific extraction
 */
function generateDomainSystemPrompt(domain: FieldDomain): string {
  const domainContext: Record<FieldDomain, string> = {
    demographics: `You are extracting personal demographic information from a case management phone call.
Focus on: names, dates of birth, ages, gender, social security numbers, and other identifying information.
Be especially careful with SSN and DOB - only extract if explicitly stated.`,

    contact: `You are extracting contact information from a case management phone call.
Focus on: phone numbers, email addresses, mailing addresses, city, state, ZIP codes.
Normalize phone numbers to (XXX) XXX-XXXX format. Verify addresses make sense.`,

    medical: `You are extracting medical information from a case management phone call.
Focus on: diagnoses, medications, treatments, doctors' names, medical conditions.
Be precise with medical terminology. Flag uncertain extractions.`,

    financial: `You are extracting financial information from a case management phone call.
Focus on: income, employment status, employer names, insurance information, benefits.
Convert income mentions to annual amounts when possible.`,

    case_details: `You are extracting case-specific information from a case management phone call.
Focus on: reason for contact, services needed, referral sources, case history.
Capture the client's stated needs accurately.`,

    other: `You are extracting miscellaneous information from a case management phone call.
Extract the requested fields carefully and note any ambiguity.`,
  };

  return `${domainContext[domain]}

IMPORTANT GUIDELINES:
1. Only extract information explicitly stated by the CLIENT in the conversation
2. Do NOT infer or guess values not clearly stated
3. If a client corrects themselves, use the corrected value
4. Note conflicting values if the client gives different answers
5. Include the exact quote (sourceSnippet) where you found the information
6. Rate confidence 0-100 based on clarity and directness of the statement
7. Confidence below 70 means the value should be reviewed by a human

Respond with a JSON object containing an "extractions" array.`;
}

/**
 * Generate user prompt for field extraction
 */
function generateDomainUserPrompt(
  transcript: string,
  fields: ExtractableField[]
): string {
  const fieldList = fields
    .map(
      (f) =>
        `- ${f.slug} (${f.name}): ${f.purpose}${f.options ? ` [Options: ${f.options.map((o) => o.value).join(", ")}]` : ""}`
    )
    .join("\n");

  return `CALL TRANSCRIPT:
${transcript}

FIELDS TO EXTRACT:
${fieldList}

Extract the values for each field from the transcript. For each field, provide:
- fieldId: the field's ID
- slug: the field's slug
- value: the extracted value (or null if not found)
- confidence: 0-100 confidence score
- reasoning: brief explanation of why you extracted this value
- sourceSnippet: the exact quote from the transcript
- conflictingValues: (optional) if the client gave multiple different answers

Respond with JSON only:
{
  "extractions": [
    {
      "fieldId": "...",
      "slug": "...",
      "value": "...",
      "confidence": 85,
      "reasoning": "...",
      "sourceSnippet": "...",
      "conflictingValues": []
    }
  ]
}`;
}

/**
 * Detect conflicts in transcript for a specific field
 */
export async function detectFieldConflicts(
  transcript: TranscriptSegment[],
  fieldSlug: string,
  fieldPurpose: string
): Promise<FieldConflict | null> {
  const formattedTranscript = formatTranscriptForExtraction(transcript);

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    system: `You are analyzing a call transcript to find if the client gave multiple different values for a specific piece of information. Only report actual conflicts where the client stated different values.`,
    messages: [
      {
        role: "user",
        content: `TRANSCRIPT:
${formattedTranscript}

FIELD: ${fieldSlug}
PURPOSE: ${fieldPurpose}

Find all instances where the client provided a value for this field. If they gave multiple different values, list them all with context.

Respond with JSON:
{
  "hasConflict": true/false,
  "values": [
    { "value": "...", "context": "quote from transcript", "confidence": 0-100 }
  ]
}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") return null;

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as {
    hasConflict: boolean;
    values: Array<{ value: string; context: string; confidence: number }>;
  };

  if (!parsed.hasConflict || parsed.values.length < 2) return null;

  return {
    fieldId: "",
    slug: fieldSlug,
    values: parsed.values,
  };
}
