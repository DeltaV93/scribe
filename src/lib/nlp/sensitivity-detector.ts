/**
 * Sensitivity Detection Service (PX-865)
 * NLP-based detection of sensitive content in transcripts
 */

import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import type { SensitivityCategory, SensitivityTier } from "@prisma/client";
import {
  SENSITIVITY_CATEGORIES,
  getAllKeywords,
  getCategoryDefinition,
} from "./categories";

export interface TranscriptSegment {
  startTime: number; // seconds
  endTime: number;
  speaker?: string;
  text: string;
}

export interface SensitivityResult {
  category: SensitivityCategory;
  confidence: number; // 0.0-1.0
  suggestedTier: SensitivityTier;
  reasoning: string;
}

export interface FlaggedSegmentResult {
  startTime: number;
  endTime: number;
  text: string;
  category: SensitivityCategory;
  confidence: number;
  suggestedTier: SensitivityTier;
  reasoning: string;
}

export interface DetectionResult {
  success: boolean;
  segments: FlaggedSegmentResult[];
  overallSensitivity: SensitivityTier;
  processingTimeMs: number;
  error?: string;
}

/**
 * Quick keyword-based pre-screening
 * Returns segments that might need AI classification
 */
function preScreenSegments(
  segments: TranscriptSegment[]
): TranscriptSegment[] {
  const keywords = getAllKeywords();
  const flaggedSegments: TranscriptSegment[] = [];

  for (const segment of segments) {
    const words = segment.text.toLowerCase().split(/\s+/);
    const hasKeyword = words.some((word) => {
      // Check exact match
      if (keywords.has(word)) return true;
      // Check partial match for compound words
      for (const [kw] of keywords) {
        if (word.includes(kw) && kw.length > 4) return true;
      }
      return false;
    });

    // Also check patterns from category definitions
    const hasPattern = SENSITIVITY_CATEGORIES.some((cat) =>
      cat.patterns.some((pattern) => pattern.test(segment.text))
    );

    if (hasKeyword || hasPattern) {
      flaggedSegments.push(segment);
    }
  }

  return flaggedSegments;
}

/**
 * Group adjacent flagged segments for context
 */
function groupAdjacentSegments(
  segments: TranscriptSegment[],
  maxGapSeconds: number = 10
): TranscriptSegment[][] {
  if (segments.length === 0) return [];

  const groups: TranscriptSegment[][] = [];
  let currentGroup: TranscriptSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];

    if (curr.startTime - prev.endTime <= maxGapSeconds) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  groups.push(currentGroup);
  return groups;
}

/**
 * Generate AI prompt for sensitivity classification
 */
function generateClassificationPrompt(text: string): string {
  const categoryDescriptions = SENSITIVITY_CATEGORIES.map(
    (cat) =>
      `- ${cat.category}: ${cat.description}
   Examples: ${cat.examples.slice(0, 2).join("; ")}`
  ).join("\n");

  return `Analyze the following conversation transcript for sensitive content.

SENSITIVITY CATEGORIES:
${categoryDescriptions}

SENSITIVITY TIERS:
- REDACTED: Personal/off-topic content that should be removed entirely
- RESTRICTED: Sensitive business content (HR, legal, health, financial) that needs access control
- STANDARD: Normal work content, no sensitivity concerns

TRANSCRIPT:
"""
${text}
"""

Analyze each section for sensitivity. Return a JSON object with this structure:
{
  "findings": [
    {
      "text": "The specific sensitive text segment",
      "category": "One of: PERSONAL_OFF_TOPIC, HR_SENSITIVE, LEGAL_SENSITIVE, HEALTH_SENSITIVE, FINANCIAL_SENSITIVE",
      "confidence": 0.0-1.0,
      "suggestedTier": "REDACTED, RESTRICTED, or STANDARD",
      "reasoning": "Brief explanation of why this is sensitive"
    }
  ],
  "overallAssessment": "Summary of sensitivity findings"
}

If no sensitive content is found, return:
{
  "findings": [],
  "overallAssessment": "No sensitive content detected"
}

Important:
- Only flag content that is clearly sensitive, not borderline cases
- Consider context - work-related health discussions may be appropriate
- Confidence should reflect how certain you are about the classification
- Personal/off-topic content defaults to REDACTED
- Business-sensitive content defaults to RESTRICTED`;
}

/**
 * Classify a text segment using Claude
 */
async function classifyWithAI(text: string): Promise<{
  findings: Array<{
    text: string;
    category: SensitivityCategory;
    confidence: number;
    suggestedTier: SensitivityTier;
    reasoning: string;
  }>;
  overallAssessment: string;
}> {
  const prompt = generateClassificationPrompt(text);

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in AI response");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Main detection function - analyze transcript for sensitive content
 */
export async function detectSensitivity(
  segments: TranscriptSegment[]
): Promise<DetectionResult> {
  const startTime = Date.now();

  try {
    // Step 1: Quick pre-screening
    const potentiallyFlagged = preScreenSegments(segments);

    if (potentiallyFlagged.length === 0) {
      return {
        success: true,
        segments: [],
        overallSensitivity: "STANDARD",
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Step 2: Group adjacent segments for context
    const groups = groupAdjacentSegments(potentiallyFlagged);

    // Step 3: Classify each group with AI
    const flaggedResults: FlaggedSegmentResult[] = [];

    for (const group of groups) {
      const combinedText = group.map((s) => s.text).join(" ");
      const startSegTime = group[0].startTime;
      const endSegTime = group[group.length - 1].endTime;

      try {
        const classification = await classifyWithAI(combinedText);

        for (const finding of classification.findings) {
          // Map finding back to original segment times
          flaggedResults.push({
            startTime: startSegTime,
            endTime: endSegTime,
            text: finding.text,
            category: finding.category,
            confidence: finding.confidence,
            suggestedTier: finding.suggestedTier,
            reasoning: finding.reasoning,
          });
        }
      } catch (error) {
        console.error("AI classification error:", error);
        // Fallback to keyword-based classification
        const fallbackCategory = determineFallbackCategory(combinedText);
        if (fallbackCategory) {
          const catDef = getCategoryDefinition(fallbackCategory);
          flaggedResults.push({
            startTime: startSegTime,
            endTime: endSegTime,
            text: combinedText,
            category: fallbackCategory,
            confidence: 0.5, // Lower confidence for fallback
            suggestedTier: catDef?.defaultTier || "RESTRICTED",
            reasoning: "Detected via keyword matching (AI unavailable)",
          });
        }
      }
    }

    // Determine overall sensitivity
    let overallSensitivity: SensitivityTier = "STANDARD";
    for (const result of flaggedResults) {
      if (result.suggestedTier === "REDACTED") {
        overallSensitivity = "REDACTED";
        break;
      } else if (result.suggestedTier === "RESTRICTED") {
        overallSensitivity = "RESTRICTED";
      }
    }

    return {
      success: true,
      segments: flaggedResults,
      overallSensitivity,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      segments: [],
      overallSensitivity: "STANDARD",
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fallback category determination using keywords
 */
function determineFallbackCategory(text: string): SensitivityCategory | null {
  const keywords = getAllKeywords();
  const words = text.toLowerCase().split(/\s+/);

  const categoryScores = new Map<SensitivityCategory, number>();

  for (const word of words) {
    const category = keywords.get(word);
    if (category) {
      categoryScores.set(category, (categoryScores.get(category) || 0) + 1);
    }
  }

  if (categoryScores.size === 0) return null;

  // Return category with highest score
  let maxCategory: SensitivityCategory | null = null;
  let maxScore = 0;

  for (const [category, score] of categoryScores) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = category;
    }
  }

  return maxCategory;
}

/**
 * Batch processing for multiple conversations
 */
export async function detectSensitivityBatch(
  transcripts: Array<{ id: string; segments: TranscriptSegment[] }>
): Promise<Map<string, DetectionResult>> {
  const results = new Map<string, DetectionResult>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 3;

  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    const batch = transcripts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ({ id, segments }) => ({
        id,
        result: await detectSensitivity(segments),
      }))
    );

    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }

  return results;
}

/**
 * Check if a specific text contains sensitive content (quick check)
 */
export function containsSensitiveContent(text: string): boolean {
  const keywords = getAllKeywords();
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    if (keywords.has(word)) return true;
  }

  for (const cat of SENSITIVITY_CATEGORIES) {
    for (const pattern of cat.patterns) {
      if (pattern.test(text)) return true;
    }
  }

  return false;
}
