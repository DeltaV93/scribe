/**
 * Workflow Output Generation Service (PX-865)
 * Generates action items, meeting notes, calendar events, and goal updates from transcripts
 */

import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import type {
  WorkflowOutputType,
  IntegrationPlatform,
} from "@prisma/client";

export interface ActionItemDraft {
  title: string;
  description: string; // Markdown
  assignee?: string; // User name or ID
  dueDate?: string; // ISO 8601
  priority?: "low" | "medium" | "high" | "urgent";
  labels?: string[];
  sourceSnippet: string;
}

export interface MeetingNotesDraft {
  title: string;
  content: string; // Markdown
  sections: Array<{
    heading: string;
    content: string;
  }>;
  attendees: string[];
  actionItems: string[]; // Summary list
  keyDecisions: string[];
  sourceSnippet?: string;
}

export interface CalendarEventDraft {
  title: string;
  description: string; // Plain text
  startTime?: string; // ISO 8601
  duration?: number; // minutes
  attendees?: string[];
  location?: string;
  sourceSnippet: string;
}

export interface GoalUpdateDraft {
  goalId?: string; // If matched to existing goal
  goalTitle?: string; // If creating new or unmatched
  updateType: "progress" | "blocker" | "risk" | "completed";
  description: string;
  percentComplete?: number;
  sourceSnippet: string;
}

export interface DelaySignalDraft {
  taskTitle: string;
  delayType: string; // e.g., "resource_constraint", "dependency_blocked"
  delayDays: number;
  reason: string;
  confidence: number;
  sourceSnippet: string;
}

export interface GeneratedOutputs {
  actionItems: ActionItemDraft[];
  meetingNotes?: MeetingNotesDraft;
  calendarEvents: CalendarEventDraft[];
  goalUpdates: GoalUpdateDraft[];
  delaySignals: DelaySignalDraft[];
}

export interface OutputGenerationResult {
  success: boolean;
  outputs: GeneratedOutputs;
  processingTimeMs: number;
  error?: string;
}

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker?: string;
  text: string;
}

/**
 * Generate workflow outputs from transcript
 */
export async function generateWorkflowOutputs(
  transcript: string,
  segments: TranscriptSegment[],
  meetingTitle?: string,
  attendees?: string[]
): Promise<OutputGenerationResult> {
  const startTime = Date.now();

  try {
    const prompt = generateExtractionPrompt(transcript, meetingTitle, attendees);

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
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

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedOutputs;

    // Add source snippets from transcript segments
    const outputs = enrichWithSourceSnippets(parsed, segments);

    return {
      success: true,
      outputs,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      outputs: {
        actionItems: [],
        calendarEvents: [],
        goalUpdates: [],
        delaySignals: [],
      },
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate prompt for output extraction
 */
function generateExtractionPrompt(
  transcript: string,
  meetingTitle?: string,
  attendees?: string[]
): string {
  return `Analyze this conversation transcript and extract structured outputs.

${meetingTitle ? `MEETING: ${meetingTitle}` : ""}
${attendees?.length ? `ATTENDEES: ${attendees.join(", ")}` : ""}

TRANSCRIPT:
"""
${transcript}
"""

Extract the following from this conversation:

1. ACTION ITEMS - Tasks that need to be done
   - Look for commitments: "I'll do...", "Can you...", "We need to..."
   - Include owner if mentioned, due date if mentioned
   - Set priority based on urgency language

2. MEETING NOTES - Summary of the conversation
   - Key topics discussed
   - Decisions made
   - Important information shared

3. CALENDAR EVENTS - Meetings or events mentioned for scheduling
   - "Let's meet on...", "Schedule a follow-up...", "We'll sync on..."
   - Include time if mentioned

4. GOAL/PROJECT UPDATES - Progress on goals or projects
   - Progress updates: "We completed...", "We're at 80%..."
   - Blockers: "We're blocked on...", "Waiting for..."
   - Risks: "We might miss...", "Concern about..."

5. DELAY SIGNALS - Indications of timeline impacts (PX-875)
   - "Need more time...", "Extra week needed..."
   - "Blocked by...", "Dependency delayed..."
   - "Resource constraint...", "Team capacity..."

Return a JSON object:
{
  "actionItems": [
    {
      "title": "Brief action title",
      "description": "Detailed description in markdown",
      "assignee": "Person name if mentioned",
      "dueDate": "ISO date if mentioned",
      "priority": "low|medium|high|urgent",
      "labels": ["relevant", "labels"],
      "sourceSnippet": "Quote from transcript"
    }
  ],
  "meetingNotes": {
    "title": "Meeting title or summary",
    "content": "Full meeting notes in markdown",
    "sections": [
      { "heading": "Discussion Topics", "content": "..." },
      { "heading": "Decisions", "content": "..." }
    ],
    "attendees": ["names mentioned"],
    "actionItems": ["summary list of action items"],
    "keyDecisions": ["decisions made"]
  },
  "calendarEvents": [
    {
      "title": "Event title",
      "description": "Event description",
      "startTime": "ISO datetime if mentioned",
      "duration": 30,
      "attendees": ["invited people"],
      "location": "if mentioned",
      "sourceSnippet": "Quote from transcript"
    }
  ],
  "goalUpdates": [
    {
      "goalTitle": "Project or goal name",
      "updateType": "progress|blocker|risk|completed",
      "description": "Update details",
      "percentComplete": 75,
      "sourceSnippet": "Quote from transcript"
    }
  ],
  "delaySignals": [
    {
      "taskTitle": "Task or project affected",
      "delayType": "resource_constraint|dependency_blocked|scope_change|technical_debt|external_blocker",
      "delayDays": 7,
      "reason": "Explanation of delay",
      "confidence": 0.8,
      "sourceSnippet": "Quote from transcript"
    }
  ]
}

Important:
- Only include items explicitly mentioned or strongly implied
- Use markdown for descriptions
- Include direct quotes as sourceSnippet
- Be conservative - quality over quantity
- If no items for a category, return empty array`;
}

/**
 * Enrich outputs with source snippets from segments
 */
function enrichWithSourceSnippets(
  outputs: GeneratedOutputs,
  segments: TranscriptSegment[]
): GeneratedOutputs {
  // Find the segment that best matches each source snippet
  const findMatchingSegment = (snippet: string): string => {
    if (!snippet) return "";

    const normalizedSnippet = snippet.toLowerCase().trim();

    for (const segment of segments) {
      const normalizedText = segment.text.toLowerCase();
      if (normalizedText.includes(normalizedSnippet.slice(0, 50))) {
        return segment.text;
      }
    }

    return snippet;
  };

  // Enrich action items
  outputs.actionItems = outputs.actionItems.map((item) => ({
    ...item,
    sourceSnippet: findMatchingSegment(item.sourceSnippet),
  }));

  // Enrich calendar events
  outputs.calendarEvents = outputs.calendarEvents.map((event) => ({
    ...event,
    sourceSnippet: findMatchingSegment(event.sourceSnippet),
  }));

  // Enrich goal updates
  outputs.goalUpdates = outputs.goalUpdates.map((update) => ({
    ...update,
    sourceSnippet: findMatchingSegment(update.sourceSnippet),
  }));

  // Enrich delay signals
  outputs.delaySignals = outputs.delaySignals.map((signal) => ({
    ...signal,
    sourceSnippet: findMatchingSegment(signal.sourceSnippet),
  }));

  return outputs;
}

/**
 * Format action item for Linear
 */
export function formatForLinear(item: ActionItemDraft): {
  title: string;
  description: string;
  priority: number;
  labels: string[];
} {
  const priorityMap: Record<string, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  let description = item.description;
  if (item.sourceSnippet) {
    description += `\n\n---\n> Source: "${item.sourceSnippet}"`;
  }

  return {
    title: item.title,
    description,
    priority: priorityMap[item.priority || "medium"],
    labels: item.labels || [],
  };
}

/**
 * Format action item for Jira
 */
export function formatForJira(item: ActionItemDraft): {
  summary: string;
  description: string;
  priority: { name: string };
  labels: string[];
  duedate?: string;
} {
  const priorityMap: Record<string, string> = {
    urgent: "Highest",
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  let description = item.description;
  if (item.sourceSnippet) {
    description += `\n\n----\n{quote}${item.sourceSnippet}{quote}`;
  }

  return {
    summary: item.title,
    description,
    priority: { name: priorityMap[item.priority || "medium"] },
    labels: item.labels || [],
    duedate: item.dueDate,
  };
}

/**
 * Format meeting notes for Notion
 */
export function formatForNotion(notes: MeetingNotesDraft): {
  title: string;
  blocks: Array<{
    type: string;
    content: string;
  }>;
} {
  const blocks: Array<{ type: string; content: string }> = [];

  // Add attendees
  if (notes.attendees.length > 0) {
    blocks.push({
      type: "paragraph",
      content: `**Attendees:** ${notes.attendees.join(", ")}`,
    });
  }

  // Add sections
  for (const section of notes.sections) {
    blocks.push({
      type: "heading_2",
      content: section.heading,
    });
    blocks.push({
      type: "paragraph",
      content: section.content,
    });
  }

  // Add action items
  if (notes.actionItems.length > 0) {
    blocks.push({
      type: "heading_2",
      content: "Action Items",
    });
    for (const item of notes.actionItems) {
      blocks.push({
        type: "to_do",
        content: item,
      });
    }
  }

  // Add key decisions
  if (notes.keyDecisions.length > 0) {
    blocks.push({
      type: "heading_2",
      content: "Key Decisions",
    });
    for (const decision of notes.keyDecisions) {
      blocks.push({
        type: "bulleted_list_item",
        content: decision,
      });
    }
  }

  return {
    title: notes.title,
    blocks,
  };
}

/**
 * Format calendar event for Google Calendar
 */
export function formatForGoogleCalendar(event: CalendarEventDraft): {
  summary: string;
  description: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  location?: string;
} {
  const result: ReturnType<typeof formatForGoogleCalendar> = {
    summary: event.title,
    description: event.description,
    start: {},
    end: {},
  };

  if (event.startTime) {
    const startDate = new Date(event.startTime);
    const endDate = new Date(
      startDate.getTime() + (event.duration || 30) * 60 * 1000
    );

    result.start = { dateTime: startDate.toISOString() };
    result.end = { dateTime: endDate.toISOString() };
  }

  if (event.location) {
    result.location = event.location;
  }

  return result;
}

/**
 * Determine best destination platform for output type
 */
export function suggestDestination(
  outputType: WorkflowOutputType,
  availableIntegrations: IntegrationPlatform[]
): IntegrationPlatform | null {
  const preferences: Record<WorkflowOutputType, IntegrationPlatform[]> = {
    ACTION_ITEM: ["LINEAR", "JIRA"],
    MEETING_NOTES: ["NOTION", "GOOGLE_DOCS"],
    DOCUMENT: ["NOTION", "GOOGLE_DOCS"],
    CALENDAR_EVENT: ["GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"],
    GOAL_UPDATE: ["LINEAR", "JIRA", "NOTION"],
    DELAY_SIGNAL: ["LINEAR", "JIRA"],
  };

  const preferredOrder = preferences[outputType] || [];

  for (const platform of preferredOrder) {
    if (availableIntegrations.includes(platform)) {
      return platform;
    }
  }

  return null;
}
