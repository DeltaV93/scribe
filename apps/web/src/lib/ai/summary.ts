import { anthropic, EXTRACTION_MODEL } from "./client";
import type { TranscriptSegment } from "@/lib/deepgram/transcribe";

export interface CallSummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  nextSteps: string[];
  clientSentiment: "positive" | "neutral" | "concerned" | "distressed";
  topics: string[];
  durationMinutes: number;
}

export interface SummaryResult {
  success: boolean;
  summary: CallSummary | null;
  tokensUsed: { input: number; output: number };
  processingTimeMs: number;
  error?: string;
}

/**
 * Generate a structured summary of a call
 */
export async function generateCallSummary(
  transcript: TranscriptSegment[],
  clientName: string,
  callDurationSeconds: number
): Promise<SummaryResult> {
  const startTime = Date.now();

  try {
    const formattedTranscript = formatTranscriptForSummary(transcript);
    const durationMinutes = Math.round(callDurationSeconds / 60);

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2048,
      system: `You are a case management assistant creating summaries of client phone calls.
Your summaries should be:
- Concise but comprehensive
- Focused on actionable information
- Professional in tone
- Sensitive to client privacy

Do NOT include specific PII (SSN, full addresses, etc.) in the summary.
DO include the nature of the client's needs, key discussion points, and agreed-upon next steps.`,
      messages: [
        {
          role: "user",
          content: `Please summarize this ${durationMinutes}-minute phone call with ${clientName}.

TRANSCRIPT:
${formattedTranscript}

Generate a structured summary in JSON format:
{
  "overview": "2-3 sentence summary of the call's purpose and outcome",
  "keyPoints": ["Important point 1", "Important point 2", ...],
  "actionItems": ["Action item 1", "Action item 2", ...],
  "nextSteps": ["Next step 1", "Next step 2", ...],
  "clientSentiment": "positive|neutral|concerned|distressed",
  "topics": ["topic1", "topic2", ...]
}

Respond with JSON only.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Omit<CallSummary, "durationMinutes">;

    return {
      success: true,
      summary: {
        ...parsed,
        durationMinutes,
      },
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Error generating call summary:", error);
    return {
      success: false,
      summary: null,
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format transcript for summary generation (more condensed than extraction)
 */
function formatTranscriptForSummary(segments: TranscriptSegment[]): string {
  // Group consecutive segments by speaker for readability
  const grouped: Array<{ speaker: string; text: string }> = [];

  for (const segment of segments) {
    const speaker =
      segment.speaker === "CASE_MANAGER"
        ? "CM"
        : segment.speaker === "CLIENT"
          ? "Client"
          : "Unknown";

    const last = grouped[grouped.length - 1];
    if (last && last.speaker === speaker) {
      // Append to existing speaker block
      last.text += " " + segment.text;
    } else {
      // New speaker block
      grouped.push({ speaker, text: segment.text });
    }
  }

  return grouped.map((g) => `${g.speaker}: ${g.text}`).join("\n\n");
}

/**
 * Generate a brief one-line summary for list views
 */
export async function generateBriefSummary(
  transcript: TranscriptSegment[]
): Promise<string> {
  try {
    const formattedTranscript = formatTranscriptForSummary(transcript);

    // Truncate if very long
    const truncated =
      formattedTranscript.length > 5000
        ? formattedTranscript.substring(0, 5000) + "..."
        : formattedTranscript;

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 100,
      system:
        "Generate a single sentence summary (under 100 characters) of this call. Focus on the main purpose or outcome.",
      messages: [
        {
          role: "user",
          content: truncated,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return "Call summary unavailable";
    }

    return textContent.text.trim();
  } catch (error) {
    console.error("Error generating brief summary:", error);
    return "Call summary unavailable";
  }
}

/**
 * Extract topics discussed in the call
 */
export async function extractCallTopics(
  transcript: TranscriptSegment[]
): Promise<string[]> {
  try {
    const clientStatements = transcript
      .filter((s) => s.speaker === "CLIENT")
      .map((s) => s.text)
      .join(" ");

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 256,
      system:
        "Extract the main topics discussed. Return a JSON array of 3-7 topic strings, each 1-3 words.",
      messages: [
        {
          role: "user",
          content: clientStatements,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return [];
    }

    const match = textContent.text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    return JSON.parse(match[0]) as string[];
  } catch (error) {
    console.error("Error extracting topics:", error);
    return [];
  }
}

/**
 * Analyze client sentiment throughout the call
 */
export async function analyzeClientSentiment(
  transcript: TranscriptSegment[]
): Promise<{
  overall: "positive" | "neutral" | "concerned" | "distressed";
  progression: Array<{
    timestamp: number;
    sentiment: string;
    snippet: string;
  }>;
}> {
  try {
    const clientSegments = transcript.filter((s) => s.speaker === "CLIENT");

    const formattedSegments = clientSegments
      .map((s) => `[${Math.floor(s.startTime)}s] ${s.text}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 512,
      system: `Analyze the client's emotional sentiment throughout this conversation.
Consider: tone, word choice, expressed concerns, relief, frustration, etc.

Return JSON:
{
  "overall": "positive|neutral|concerned|distressed",
  "progression": [
    { "timestamp": 0, "sentiment": "neutral", "snippet": "quote" }
  ]
}`,
      messages: [
        {
          role: "user",
          content: formattedSegments,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { overall: "neutral", progression: [] };
    }

    const match = textContent.text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { overall: "neutral", progression: [] };
    }

    return JSON.parse(match[0]);
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { overall: "neutral", progression: [] };
  }
}
