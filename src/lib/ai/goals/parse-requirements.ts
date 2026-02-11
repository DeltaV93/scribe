/**
 * AI Funder Requirements Parser
 *
 * Uses Claude to parse funder documents and extract
 * suggested deliverables/metrics for goal creation.
 */

import { anthropic, EXTRACTION_MODEL, logClaudeUsage } from "@/lib/ai/client";
import { MetricType } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface SuggestedDeliverable {
  name: string;
  description: string;
  metricType: MetricType;
  targetValue: number;
  unit?: string;
  dueDate?: string;
  confidence: number; // 0-100
  originalText?: string;
}

export interface ParseResult {
  deliverables: SuggestedDeliverable[];
  reportingRequirements: ReportingRequirement[];
  generalNotes: string[];
  confidence: number;
}

export interface ReportingRequirement {
  frequency: "monthly" | "quarterly" | "annually" | "other";
  description: string;
  dueDate?: string;
}

// ============================================
// PROMPTS
// ============================================

const PARSE_REQUIREMENTS_PROMPT = `You are analyzing a funder document or grant requirements to extract deliverables and metrics for a nonprofit organization.

Given the document text, identify:
1. **Quantitative deliverables** - Specific numeric targets (e.g., "serve 100 clients", "80% completion rate")
2. **Qualitative milestones** - Non-numeric achievements (e.g., "establish partnerships", "launch program")
3. **Reporting requirements** - When and how progress should be reported
4. **Deadlines** - Specific dates mentioned for deliverables or milestones

For each deliverable, determine the most appropriate metric type:
- CLIENT_CONTACTS: Number of client interactions/touchpoints
- CLIENTS_ENROLLED: Number of clients enrolled in programs
- PROGRAM_COMPLETIONS: Number of clients completing programs
- CLIENTS_HOUSED: Number of clients housed (housing-focused)
- SESSIONS_DELIVERED: Number of sessions/classes delivered
- FORM_SUBMISSIONS: Number of forms/applications completed
- CUSTOM: For metrics that don't fit other categories

Return a JSON object with this structure:
{
  "deliverables": [
    {
      "name": "Clear title for the deliverable",
      "description": "Full context and requirements",
      "metricType": "CLIENTS_ENROLLED",
      "targetValue": 100,
      "unit": "clients",
      "dueDate": "2024-12-31",
      "confidence": 85,
      "originalText": "The exact text from the document"
    }
  ],
  "reportingRequirements": [
    {
      "frequency": "quarterly",
      "description": "Submit progress report to funder",
      "dueDate": "End of each quarter"
    }
  ],
  "generalNotes": [
    "Any important context or caveats"
  ],
  "confidence": 80
}

Important guidelines:
- Only include deliverables you can clearly identify from the text
- Set confidence based on how explicit the requirement is (100 = explicitly stated, 50 = inferred)
- Use targetValue of 0 for qualitative milestones
- If dates are relative (e.g., "by end of year 1"), note this in the description
- Include originalText so users can verify the interpretation`;

// ============================================
// PARSING FUNCTIONS
// ============================================

/**
 * Parse funder document text to extract deliverables
 */
export async function parseRequirements(text: string): Promise<ParseResult> {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: PARSE_REQUIREMENTS_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please analyze this funder document and extract the deliverables and requirements:\n\n${text}`,
        },
      ],
    });

    logClaudeUsage(
      "parse_funder_requirements",
      EXTRACTION_MODEL,
      response.usage,
      Date.now() - startTime
    );

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const result = extractJsonFromText(content.text);

    // Validate and normalize the result
    return normalizeParseResult(result);
  } catch (error) {
    console.error("Failed to parse requirements:", error);
    throw error;
  }
}

/**
 * Extract JSON from Claude's response text
 */
function extractJsonFromText(text: string): ParseResult {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`);
  }
}

/**
 * Normalize and validate the parsed result
 */
function normalizeParseResult(raw: unknown): ParseResult {
  const result = raw as ParseResult;

  // Ensure arrays exist
  result.deliverables = result.deliverables || [];
  result.reportingRequirements = result.reportingRequirements || [];
  result.generalNotes = result.generalNotes || [];
  result.confidence = result.confidence || 50;

  // Validate and normalize each deliverable
  result.deliverables = result.deliverables.map((d) => ({
    name: d.name || "Unnamed deliverable",
    description: d.description || "",
    metricType: validateMetricType(d.metricType),
    targetValue: typeof d.targetValue === "number" ? d.targetValue : 0,
    unit: d.unit,
    dueDate: d.dueDate,
    confidence: Math.min(100, Math.max(0, d.confidence || 50)),
    originalText: d.originalText,
  }));

  // Validate reporting requirements
  result.reportingRequirements = result.reportingRequirements.map((r) => ({
    frequency: validateFrequency(r.frequency),
    description: r.description || "",
    dueDate: r.dueDate,
  }));

  return result;
}

/**
 * Validate metric type
 */
function validateMetricType(type: unknown): MetricType {
  const validTypes = [
    "CLIENT_CONTACTS",
    "CLIENTS_ENROLLED",
    "PROGRAM_COMPLETIONS",
    "CLIENTS_HOUSED",
    "SESSIONS_DELIVERED",
    "FORM_SUBMISSIONS",
    "CUSTOM",
  ];

  if (typeof type === "string" && validTypes.includes(type)) {
    return type as MetricType;
  }

  return MetricType.CUSTOM;
}

/**
 * Validate reporting frequency
 */
function validateFrequency(
  freq: unknown
): "monthly" | "quarterly" | "annually" | "other" {
  const validFreqs = ["monthly", "quarterly", "annually", "other"];

  if (typeof freq === "string" && validFreqs.includes(freq)) {
    return freq as "monthly" | "quarterly" | "annually" | "other";
  }

  return "other";
}

// ============================================
// INTERVIEW-STYLE PARSING
// ============================================

export interface InterviewQuestion {
  question: string;
  context: string;
  fieldToPopulate: string;
  options?: string[];
}

/**
 * Generate follow-up questions to clarify ambiguous requirements
 */
export async function generateClarifyingQuestions(
  text: string,
  currentDeliverables: SuggestedDeliverable[]
): Promise<InterviewQuestion[]> {
  const lowConfidenceItems = currentDeliverables.filter((d) => d.confidence < 70);

  if (lowConfidenceItems.length === 0) {
    return [];
  }

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 2048,
    system: `You are helping clarify ambiguous grant requirements. Generate 1-3 specific questions to help determine exact metrics for low-confidence deliverables.

Return JSON array:
[
  {
    "question": "The question to ask",
    "context": "Why this matters",
    "fieldToPopulate": "targetValue" | "metricType" | "dueDate",
    "options": ["Option 1", "Option 2"] // optional
  }
]`,
    messages: [
      {
        role: "user",
        content: `Original text:\n${text}\n\nLow confidence items:\n${JSON.stringify(lowConfidenceItems, null, 2)}`,
      },
    ],
  });

  logClaudeUsage(
    "generate_clarifying_questions",
    EXTRACTION_MODEL,
    response.usage,
    Date.now() - startTime
  );

  const content = response.content[0];
  if (content.type !== "text") {
    return [];
  }

  try {
    const match = content.text.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

// ============================================
// DOCUMENT PROCESSING
// ============================================

/**
 * Parse PDF content (extracted text) for requirements
 */
export async function parsePdfRequirements(extractedText: string): Promise<ParseResult> {
  // Clean up common PDF extraction artifacts
  const cleanedText = extractedText
    .replace(/\f/g, "\n") // Form feeds
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // Multiple newlines
    .replace(/^\s+$/gm, "") // Empty lines with whitespace
    .trim();

  return parseRequirements(cleanedText);
}

/**
 * Compare suggested deliverables with existing ones
 */
export function diffDeliverables(
  suggested: SuggestedDeliverable[],
  existing: Array<{ name: string; targetValue: number; metricType: string }>
): {
  new: SuggestedDeliverable[];
  updated: Array<{ suggested: SuggestedDeliverable; existing: typeof existing[0] }>;
  unchanged: SuggestedDeliverable[];
} {
  const result = {
    new: [] as SuggestedDeliverable[],
    updated: [] as Array<{ suggested: SuggestedDeliverable; existing: typeof existing[0] }>,
    unchanged: [] as SuggestedDeliverable[],
  };

  for (const s of suggested) {
    // Find matching existing deliverable by name similarity
    const match = existing.find(
      (e) =>
        e.name.toLowerCase().includes(s.name.toLowerCase()) ||
        s.name.toLowerCase().includes(e.name.toLowerCase())
    );

    if (!match) {
      result.new.push(s);
    } else if (
      match.targetValue !== s.targetValue ||
      match.metricType !== s.metricType
    ) {
      result.updated.push({ suggested: s, existing: match });
    } else {
      result.unchanged.push(s);
    }
  }

  return result;
}
