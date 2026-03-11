/**
 * Knowledge Base - Extraction Service
 *
 * Extracts institutional knowledge from meeting summaries and transcripts.
 */

import { prisma } from "@/lib/db";
import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import {
  MeetingKnowledgeExtractionParams,
  ExtractedKnowledge,
  ExtractionResult,
} from "./types";

/**
 * Extract knowledge entries from a completed meeting
 */
export async function extractKnowledgeFromMeeting(
  params: MeetingKnowledgeExtractionParams
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const { meetingId, orgId } = params;

  // Get the meeting with summary
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    include: {
      summary: true,
      transcript: true,
    },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (!meeting.summary) {
    throw new Error("Meeting has no summary - cannot extract knowledge");
  }

  // Prepare context for extraction
  const summaryData = meeting.summary;
  const keyPoints = (summaryData.keyPoints as Array<{ point: string }>) || [];
  const decisions = (summaryData.decisions as Array<{ decision: string; context?: string }>) || [];
  const topics = summaryData.topicsDiscussed || [];

  const contextText = `
Meeting Title: ${meeting.title}
Date: ${meeting.actualStartAt?.toISOString() || meeting.scheduledStartAt?.toISOString() || "Unknown"}
Tags: ${meeting.tags.join(", ") || "None"}

Executive Summary:
${summaryData.executiveSummary}

Key Points:
${keyPoints.map((kp) => `- ${kp.point}`).join("\n")}

Decisions Made:
${decisions.map((d) => `- ${d.decision}${d.context ? ` (Context: ${d.context})` : ""}`).join("\n")}

Topics Discussed:
${topics.join(", ")}
`.trim();

  // Use Claude to extract knowledge entries
  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert at extracting institutional knowledge from meeting summaries. Your goal is to identify discrete pieces of knowledge that would be valuable for an organization to preserve and make searchable.

Analyze the following meeting information and extract distinct knowledge entries. Each entry should be:
1. Self-contained and understandable without the meeting context
2. Focused on one specific topic, decision, or piece of information
3. Valuable for future reference (policies, decisions, processes, insights)

For each knowledge entry, provide:
- title: A clear, descriptive title (max 100 characters)
- content: The full knowledge content, written clearly for future readers
- summary: A 1-2 sentence summary
- category: One of: "Decision", "Policy", "Process", "Insight", "Action", "Information"
- tags: Relevant keywords for search (3-7 tags)

Only extract entries that represent significant institutional knowledge. Skip routine updates or transient information.

Meeting Context:
${contextText}

Respond with a JSON object containing an "entries" array. Each entry should have: title, content, summary, category, tags.
If there is no significant knowledge to extract, return {"entries": []}.

Example response format:
{
  "entries": [
    {
      "title": "New Remote Work Policy Approved",
      "content": "The team approved a new remote work policy allowing employees to work remotely up to 3 days per week. This applies to all departments starting Q2. Managers will be responsible for coordinating in-office days to ensure team collaboration.",
      "summary": "New policy allowing 3 days/week remote work, starting Q2, with manager coordination.",
      "category": "Policy",
      "tags": ["remote-work", "policy", "hr", "flexibility"]
    }
  ]
}`,
      },
    ],
  });

  // Parse the response
  const contentBlock = response.content[0];
  if (contentBlock.type !== "text") {
    throw new Error("Unexpected response format from Claude");
  }

  let entries: ExtractedKnowledge[] = [];

  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = contentBlock.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);
    entries = parsed.entries || [];
  } catch (error) {
    console.error("Failed to parse Claude response:", contentBlock.text);
    throw new Error("Failed to parse knowledge extraction response");
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    entries,
    meetingId,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    processingTimeMs,
  };
}

/**
 * Auto-populate knowledge base from a completed meeting
 * Creates KnowledgeEntry records for each extracted piece of knowledge
 */
export async function autoPopulateKnowledgeFromMeeting(
  params: MeetingKnowledgeExtractionParams
): Promise<{ entriesCreated: number; entryIds: string[] }> {
  const { meetingId, orgId, userId } = params;

  // Extract knowledge
  const extractionResult = await extractKnowledgeFromMeeting(params);

  if (extractionResult.entries.length === 0) {
    return { entriesCreated: 0, entryIds: [] };
  }

  // Import embedding utilities
  const { generateEmbedding, prepareTextForEmbedding } = await import("./embeddings");

  // Create knowledge entries
  const entryIds: string[] = [];

  for (const entry of extractionResult.entries) {
    // Generate embedding for semantic search
    const textForEmbedding = prepareTextForEmbedding(
      entry.title,
      entry.content,
      entry.summary
    );
    const embeddingResult = await generateEmbedding(textForEmbedding);

    // Create the entry
    const created = await prisma.knowledgeEntry.create({
      data: {
        orgId,
        title: entry.title,
        content: entry.content,
        summary: entry.summary,
        source: "MEETING",
        meetingId,
        tags: entry.tags,
        category: entry.category,
        embeddingVector: embeddingResult.embedding,
        createdById: userId,
      },
    });

    entryIds.push(created.id);
  }

  return {
    entriesCreated: entryIds.length,
    entryIds,
  };
}
