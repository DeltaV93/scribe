/**
 * Meeting Summarization Service
 *
 * Uses Claude to generate structured summaries from meeting transcripts.
 * Extracts key points, decisions, action items, and unanswered questions.
 */

import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import {
  TranscriptSegment,
  MeetingSummaryResult,
  KeyPoint,
  Decision,
  ExtractedActionItem,
  ExtractedQuestion,
} from "./types";
import { formatTranscript } from "./transcription";

// ============================================
// SUMMARIZATION
// ============================================

/**
 * Generate a comprehensive meeting summary from transcript
 */
export async function summarizeMeeting(
  transcript: string | TranscriptSegment[],
  meetingTitle: string,
  participantNames?: string[]
): Promise<MeetingSummaryResult> {
  const startTime = Date.now();

  // Format transcript if segments provided
  const transcriptText = Array.isArray(transcript)
    ? formatTranscript(transcript)
    : transcript;

  const prompt = buildSummarizationPrompt(transcriptText, meetingTitle, participantNames);

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = parseClaudeResponse(content.text);

  const processingTimeMs = Date.now() - startTime;

  return {
    ...parsed,
    summaryModel: EXTRACTION_MODEL,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    processingTimeMs,
  };
}

/**
 * Build the summarization prompt
 */
function buildSummarizationPrompt(
  transcript: string,
  meetingTitle: string,
  participantNames?: string[]
): string {
  const participantList = participantNames?.length
    ? `Known participants: ${participantNames.join(", ")}`
    : "";

  return `You are an expert meeting analyst. Analyze this meeting transcript and extract structured information.

**Meeting Title:** ${meetingTitle}
${participantList}

**Transcript:**
${transcript}

---

Provide a comprehensive analysis in the following JSON format:

{
  "executiveSummary": "2-3 paragraph summary covering the main purpose of the meeting, key outcomes, and any notable discussions",

  "keyPoints": [
    {
      "point": "Clear, concise summary of an important point discussed",
      "context": "Brief context or why this matters",
      "speakerName": "Who raised this (if identifiable)"
    }
  ],

  "decisions": [
    {
      "decision": "A specific decision that was made",
      "context": "What led to this decision",
      "participants": ["Names of people involved in the decision"]
    }
  ],

  "actionItems": [
    {
      "description": "Specific task to be done",
      "assigneeName": "Person responsible (if mentioned)",
      "dueDate": "Due date if mentioned (ISO format)",
      "contextSnippet": "Brief quote from transcript"
    }
  ],

  "questions": [
    {
      "question": "Question that was asked",
      "askedByName": "Person who asked (if identifiable)",
      "isAnswered": true/false,
      "answer": "The answer if provided",
      "answeredByName": "Who answered (if identifiable)"
    }
  ],

  "topicsDiscussed": ["topic1", "topic2", "topic3"]
}

**Guidelines:**
- Be specific and actionable with action items
- Identify ALL decisions, even small ones
- Flag questions that weren't fully answered (isAnswered: false)
- Topics should be 2-5 words each, suitable for categorization
- If you can't identify a speaker, omit the name field rather than guessing
- For dates, use ISO format (YYYY-MM-DD) or relative terms like "next week"

Only output valid JSON, no other text.`;
}

/**
 * Parse Claude's response into structured data
 */
function parseClaudeResponse(responseText: string): Omit<MeetingSummaryResult, "summaryModel" | "tokensUsed" | "processingTimeMs"> {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      executiveSummary: parsed.executiveSummary || "",
      keyPoints: validateKeyPoints(parsed.keyPoints || []),
      decisions: validateDecisions(parsed.decisions || []),
      actionItems: validateActionItems(parsed.actionItems || []),
      questions: validateQuestions(parsed.questions || []),
      topicsDiscussed: Array.isArray(parsed.topicsDiscussed) ? parsed.topicsDiscussed : [],
    };
  } catch (error) {
    console.error("Failed to parse Claude response:", error);
    console.error("Response text:", responseText.slice(0, 500));

    // Return empty structure rather than failing
    return {
      executiveSummary: "Summary generation failed. Please review the transcript manually.",
      keyPoints: [],
      decisions: [],
      actionItems: [],
      questions: [],
      topicsDiscussed: [],
    };
  }
}

function validateKeyPoints(points: unknown[]): KeyPoint[] {
  return points
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      point: String(p.point || ""),
      context: p.context ? String(p.context) : undefined,
      speakerName: p.speakerName ? String(p.speakerName) : undefined,
    }))
    .filter((p) => p.point.length > 0);
}

function validateDecisions(decisions: unknown[]): Decision[] {
  return decisions
    .filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null)
    .map((d) => ({
      decision: String(d.decision || ""),
      context: d.context ? String(d.context) : undefined,
      participants: Array.isArray(d.participants) ? d.participants.map(String) : undefined,
    }))
    .filter((d) => d.decision.length > 0);
}

function validateActionItems(items: unknown[]): ExtractedActionItem[] {
  return items
    .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
    .map((i) => ({
      description: String(i.description || ""),
      assigneeName: i.assigneeName ? String(i.assigneeName) : undefined,
      dueDate: i.dueDate ? String(i.dueDate) : undefined,
      contextSnippet: i.contextSnippet ? String(i.contextSnippet) : undefined,
    }))
    .filter((i) => i.description.length > 0);
}

function validateQuestions(questions: unknown[]): ExtractedQuestion[] {
  return questions
    .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
    .map((q) => ({
      question: String(q.question || ""),
      askedByName: q.askedByName ? String(q.askedByName) : undefined,
      isAnswered: Boolean(q.isAnswered),
      answer: q.answer ? String(q.answer) : undefined,
      answeredByName: q.answeredByName ? String(q.answeredByName) : undefined,
      contextSnippet: q.contextSnippet ? String(q.contextSnippet) : undefined,
    }))
    .filter((q) => q.question.length > 0);
}

// ============================================
// INCREMENTAL SUMMARIZATION (FOR LONG MEETINGS)
// ============================================

/**
 * Summarize a long meeting by chunking the transcript
 * Used for meetings > 4 hours to avoid token limits
 */
export async function summarizeLongMeeting(
  segments: TranscriptSegment[],
  meetingTitle: string,
  participantNames?: string[]
): Promise<MeetingSummaryResult> {
  const startTime = Date.now();

  // Split into ~30 minute chunks based on timestamps
  const chunks = splitIntoChunks(segments, 30 * 60); // 30 minutes in seconds

  // Summarize each chunk
  const chunkSummaries: MeetingSummaryResult[] = [];
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTitle = `${meetingTitle} (Part ${i + 1}/${chunks.length})`;

    const summary = await summarizeMeeting(chunk, chunkTitle, participantNames);
    chunkSummaries.push(summary);
    totalTokens += summary.tokensUsed;
  }

  // Combine chunk summaries
  const combined = combineChunkSummaries(chunkSummaries);

  // Generate final executive summary from combined data
  const finalSummary = await generateFinalExecutiveSummary(combined, meetingTitle);

  const processingTimeMs = Date.now() - startTime;

  return {
    ...combined,
    executiveSummary: finalSummary.executiveSummary,
    summaryModel: EXTRACTION_MODEL,
    tokensUsed: totalTokens + finalSummary.tokensUsed,
    processingTimeMs,
  };
}

/**
 * Split segments into time-based chunks
 */
function splitIntoChunks(
  segments: TranscriptSegment[],
  chunkDurationSeconds: number
): TranscriptSegment[][] {
  if (segments.length === 0) return [];

  const chunks: TranscriptSegment[][] = [];
  let currentChunk: TranscriptSegment[] = [];
  let chunkStartTime = segments[0].startTime;

  for (const segment of segments) {
    if (segment.startTime - chunkStartTime > chunkDurationSeconds && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      chunkStartTime = segment.startTime;
    }
    currentChunk.push(segment);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Combine multiple chunk summaries into one
 */
function combineChunkSummaries(summaries: MeetingSummaryResult[]): MeetingSummaryResult {
  return {
    executiveSummary: "", // Will be regenerated
    keyPoints: summaries.flatMap((s) => s.keyPoints),
    decisions: summaries.flatMap((s) => s.decisions),
    actionItems: deduplicateActionItems(summaries.flatMap((s) => s.actionItems)),
    questions: deduplicateQuestions(summaries.flatMap((s) => s.questions)),
    topicsDiscussed: [...new Set(summaries.flatMap((s) => s.topicsDiscussed))],
    summaryModel: EXTRACTION_MODEL,
    tokensUsed: 0,
    processingTimeMs: 0,
  };
}

/**
 * Remove duplicate action items based on description similarity
 */
function deduplicateActionItems(items: ExtractedActionItem[]): ExtractedActionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.description.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Remove duplicate questions based on text similarity
 */
function deduplicateQuestions(questions: ExtractedQuestion[]): ExtractedQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const normalized = q.question.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Generate a final executive summary from combined data
 */
async function generateFinalExecutiveSummary(
  combined: MeetingSummaryResult,
  meetingTitle: string
): Promise<{ executiveSummary: string; tokensUsed: number }> {
  const prompt = `Generate a 2-3 paragraph executive summary for this meeting.

**Meeting Title:** ${meetingTitle}

**Key Points:**
${combined.keyPoints.map((p) => `- ${p.point}`).join("\n")}

**Decisions Made:**
${combined.decisions.map((d) => `- ${d.decision}`).join("\n")}

**Action Items:** ${combined.actionItems.length} items
**Topics:** ${combined.topicsDiscussed.join(", ")}

Write a clear, professional executive summary covering the main purpose, outcomes, and significance of this meeting. Only output the summary text, no JSON or formatting.`;

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  const text = content.type === "text" ? content.text : "";

  return {
    executiveSummary: text.trim(),
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}
