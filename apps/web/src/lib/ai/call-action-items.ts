import { anthropic, EXTRACTION_MODEL } from "./client";
import { prisma } from "@/lib/db";
import { ActionItemStatus, ActionItemSource } from "@prisma/client";
import { createReminder } from "@/lib/services/reminders";
import { addDays, format } from "date-fns";
import type {
  SchedulingClassification,
  ActionItemWithScheduling,
  RecurrencePattern,
} from "@/lib/calendar/scheduling/types";

// ============================================
// TYPES
// ============================================

export interface ExtractedActionItem {
  description: string;
  assigneeName?: string;
  assigneeRole?: "CASE_MANAGER" | "CLIENT" | "OTHER";
  dueDate?: string; // ISO date string or relative like "next week"
  priority?: 1 | 2 | 3; // 1=High, 2=Normal, 3=Low
  contextSnippet?: string;
  timestampSeconds?: number;
  confidence: number;
}

export interface ActionItemExtractionResult {
  items: ExtractedActionItem[];
  rawResponse: string;
}

/**
 * Result from extraction with scheduling analysis
 */
export interface ActionItemWithSchedulingResult {
  items: ActionItemWithScheduling[];
  rawResponse: string;
}

// Re-export scheduling types for convenience
export type { ActionItemWithScheduling, SchedulingClassification };

// ============================================
// EXTRACTION PROMPT
// ============================================

const EXTRACTION_PROMPT = `You are analyzing a call transcript between a case manager and a client. Extract any action items, tasks, or follow-up commitments mentioned.

For each action item, identify:
1. **description**: What needs to be done (be specific and actionable)
2. **assigneeName**: Who is responsible (use exact name if mentioned, or "Case Manager" / "Client")
3. **assigneeRole**: CASE_MANAGER, CLIENT, or OTHER
4. **dueDate**: When it should be done (extract exact date or relative timeframe like "next week", "by Friday", "in 3 days")
5. **priority**: 1 (High/urgent), 2 (Normal), or 3 (Low/whenever possible)
6. **contextSnippet**: The exact quote from the transcript where this was mentioned (max 100 chars)
7. **confidence**: How confident you are this is a real action item (0.0-1.0)

Only extract clear commitments or tasks, not casual mentions. An action item should have:
- A clear action to take
- An implied or explicit owner
- Some sense of timing (even if vague)

Return a JSON array of action items. If no action items found, return an empty array.

Example output:
[
  {
    "description": "Submit housing application to Section 8 office",
    "assigneeName": "Maria",
    "assigneeRole": "CLIENT",
    "dueDate": "next Monday",
    "priority": 1,
    "contextSnippet": "Maria: I'll get that application in by Monday",
    "confidence": 0.95
  },
  {
    "description": "Send job training program information via email",
    "assigneeName": "Case Manager",
    "assigneeRole": "CASE_MANAGER",
    "dueDate": "today",
    "priority": 2,
    "contextSnippet": "I'll email you that information today",
    "confidence": 0.9
  }
]

TRANSCRIPT:
`;

// ============================================
// EXTRACTION WITH SCHEDULING PROMPT
// ============================================

/**
 * Build the extraction prompt with scheduling analysis
 * @param callTimestamp - ISO timestamp of the call for relative date resolution
 */
function buildSchedulingExtractionPrompt(callTimestamp: string): string {
  return `You are analyzing a call transcript between a case manager and a client. Extract any action items, tasks, or follow-up commitments mentioned.

CALL TIMESTAMP: ${callTimestamp}
Use this timestamp as the anchor for resolving relative date references (e.g., "tomorrow" = day after call date).

For each action item, identify:
1. **description**: What needs to be done (be specific and actionable)
2. **assigneeName**: Who is responsible (use exact name if mentioned, or "Case Manager" / "Client")
3. **assigneeRole**: CASE_MANAGER, CLIENT, or OTHER
4. **dueDate**: When it should be done (extract exact date or relative timeframe like "next week", "by Friday", "in 3 days")
5. **priority**: 1 (High/urgent), 2 (Normal), or 3 (Low/whenever possible)
6. **contextSnippet**: The exact quote from the transcript where this was mentioned (max 100 chars)
7. **confidence**: How confident you are this is a real action item (0.0-1.0)

8. **scheduling**: For each action item, analyze if it involves scheduling a future event:

   - **hasSchedulingIntent**: (boolean) Does this action item involve scheduling a meeting, call, appointment, session, visit, or follow-up?

   - **tier**: Classify the timing specificity:
     - "TIER_1": Explicit date AND time mentioned (e.g., "Thursday March 5th at 2pm", "tomorrow at 10am", "next Monday at 3")
     - "TIER_2": Vague timing (e.g., "sometime next week", "soon", "in a few days", "let's reconnect")

   - **explicitDateTime**: (only if TIER_1) Extract the resolved date and time:
     - "date": ISO date format YYYY-MM-DD (resolve relative dates using call timestamp)
     - "time": 24-hour format HH:mm
     - "confidence": 0.0-1.0 how confident in the extraction

   - **vagueReference**: (only if TIER_2) The vague timing phrase (e.g., "next week", "soon", "in a few days")

   - **recurrence**: If recurring meetings are mentioned:
     - "detected": (boolean) true if recurrence mentioned
     - "pattern": DAILY, WEEKLY, BIWEEKLY, MONTHLY, or CUSTOM
     - "daysOfWeek": Array of day names if applicable (e.g., ["Monday", "Wednesday"])
     - "confidence": 0.0-1.0

   - **participants**: Array of names of people involved in the scheduled event (from conversation context)

Only extract clear commitments or tasks, not casual mentions. An action item should have:
- A clear action to take
- An implied or explicit owner
- Some sense of timing (even if vague)

Return a JSON array of action items. If no action items found, return an empty array.

Example output:
[
  {
    "description": "Schedule follow-up appointment to review housing progress",
    "assigneeName": "Case Manager",
    "assigneeRole": "CASE_MANAGER",
    "dueDate": "Thursday at 2pm",
    "priority": 2,
    "contextSnippet": "Let's meet again Thursday at 2pm to check on your progress",
    "confidence": 0.95,
    "scheduling": {
      "hasSchedulingIntent": true,
      "tier": "TIER_1",
      "explicitDateTime": {
        "date": "2024-03-07",
        "time": "14:00",
        "confidence": 0.95
      },
      "recurrence": {
        "detected": false
      },
      "participants": ["Maria"]
    }
  },
  {
    "description": "Set up weekly check-in calls",
    "assigneeName": "Case Manager",
    "assigneeRole": "CASE_MANAGER",
    "dueDate": "next week",
    "priority": 2,
    "contextSnippet": "We should do weekly calls to stay on track",
    "confidence": 0.85,
    "scheduling": {
      "hasSchedulingIntent": true,
      "tier": "TIER_2",
      "vagueReference": "next week",
      "recurrence": {
        "detected": true,
        "pattern": "WEEKLY",
        "confidence": 0.9
      },
      "participants": ["Maria"]
    }
  },
  {
    "description": "Submit housing application to Section 8 office",
    "assigneeName": "Maria",
    "assigneeRole": "CLIENT",
    "dueDate": "next Monday",
    "priority": 1,
    "contextSnippet": "Maria: I'll get that application in by Monday",
    "confidence": 0.95,
    "scheduling": {
      "hasSchedulingIntent": false,
      "tier": "TIER_2"
    }
  }
]

TRANSCRIPT:
`;
}

// ============================================
// EXTRACTION FUNCTION
// ============================================

/**
 * Extract action items from a call transcript using Claude AI
 */
export async function extractActionItems(
  transcript: string
): Promise<ActionItemExtractionResult> {
  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: EXTRACTION_PROMPT + transcript,
      },
    ],
  });

  const rawResponse =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON from response
  const items = parseActionItems(rawResponse);

  return {
    items,
    rawResponse,
  };
}

/**
 * Extract action items with scheduling classification from a call transcript
 *
 * This enhanced version includes scheduling intent analysis for each action item,
 * enabling automatic calendar event creation for items with explicit date/time.
 *
 * @param transcript - The call transcript text
 * @param callTimestamp - The timestamp of the call (used for resolving relative dates)
 */
export async function extractActionItemsWithScheduling(
  transcript: string,
  callTimestamp: Date
): Promise<ActionItemWithSchedulingResult> {
  const timestampStr = format(callTimestamp, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const prompt = buildSchedulingExtractionPrompt(timestampStr);

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4000, // Larger response for scheduling data
    messages: [
      {
        role: "user",
        content: prompt + transcript,
      },
    ],
  });

  const rawResponse =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON from response with scheduling data
  const items = parseActionItemsWithScheduling(rawResponse);

  return {
    items,
    rawResponse,
  };
}

/**
 * Parse action items from AI response
 */
function parseActionItems(response: string): ExtractedActionItem[] {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item.description && item.confidence >= 0.5)
      .map((item) => ({
        description: String(item.description).slice(0, 500),
        assigneeName: item.assigneeName ? String(item.assigneeName).slice(0, 100) : undefined,
        assigneeRole: validateRole(item.assigneeRole),
        dueDate: item.dueDate ? String(item.dueDate) : undefined,
        priority: validatePriority(item.priority),
        contextSnippet: item.contextSnippet ? String(item.contextSnippet).slice(0, 200) : undefined,
        timestampSeconds: typeof item.timestampSeconds === "number" ? item.timestampSeconds : undefined,
        confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
      }));
  } catch (error) {
    console.error("Error parsing action items:", error);
    return [];
  }
}

function validateRole(role: unknown): "CASE_MANAGER" | "CLIENT" | "OTHER" | undefined {
  if (role === "CASE_MANAGER" || role === "CLIENT" || role === "OTHER") {
    return role;
  }
  return undefined;
}

function validatePriority(priority: unknown): 1 | 2 | 3 | undefined {
  if (priority === 1 || priority === 2 || priority === 3) {
    return priority;
  }
  return undefined;
}

function validateRecurrencePattern(pattern: unknown): RecurrencePattern | undefined {
  const validPatterns: RecurrencePattern[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"];
  if (typeof pattern === "string" && validPatterns.includes(pattern as RecurrencePattern)) {
    return pattern as RecurrencePattern;
  }
  return undefined;
}

function validateSchedulingTier(tier: unknown): "TIER_1" | "TIER_2" {
  if (tier === "TIER_1") return "TIER_1";
  return "TIER_2";
}

/**
 * Parse action items with scheduling data from AI response
 */
function parseActionItemsWithScheduling(response: string): ActionItemWithScheduling[] {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item.description && item.confidence >= 0.5)
      .map((item) => {
        // Parse scheduling data
        const scheduling = parseSchedulingClassification(item.scheduling);

        return {
          description: String(item.description).slice(0, 500),
          assigneeName: item.assigneeName ? String(item.assigneeName).slice(0, 100) : undefined,
          assigneeRole: validateRole(item.assigneeRole),
          dueDate: item.dueDate ? String(item.dueDate) : undefined,
          priority: validatePriority(item.priority),
          contextSnippet: item.contextSnippet ? String(item.contextSnippet).slice(0, 200) : undefined,
          timestampSeconds: typeof item.timestampSeconds === "number" ? item.timestampSeconds : undefined,
          confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
          scheduling,
        };
      });
  } catch (error) {
    console.error("Error parsing action items with scheduling:", error);
    return [];
  }
}

/**
 * Parse scheduling classification from AI response
 */
function parseSchedulingClassification(data: unknown): SchedulingClassification {
  // Default: no scheduling intent
  const defaultClassification: SchedulingClassification = {
    hasSchedulingIntent: false,
    tier: "TIER_2",
  };

  if (!data || typeof data !== "object") {
    return defaultClassification;
  }

  const scheduling = data as Record<string, unknown>;

  const result: SchedulingClassification = {
    hasSchedulingIntent: Boolean(scheduling.hasSchedulingIntent),
    tier: validateSchedulingTier(scheduling.tier),
  };

  // Parse explicit date/time (TIER_1)
  if (scheduling.explicitDateTime && typeof scheduling.explicitDateTime === "object") {
    const dt = scheduling.explicitDateTime as Record<string, unknown>;
    if (dt.date && dt.time) {
      result.explicitDateTime = {
        date: String(dt.date),
        time: String(dt.time),
        confidence: typeof dt.confidence === "number" ? Math.min(1, Math.max(0, dt.confidence)) : 0.7,
      };
    }
  }

  // Parse vague reference (TIER_2)
  if (scheduling.vagueReference) {
    result.vagueReference = String(scheduling.vagueReference).slice(0, 100);
  }

  // Parse recurrence
  if (scheduling.recurrence && typeof scheduling.recurrence === "object") {
    const rec = scheduling.recurrence as Record<string, unknown>;
    result.recurrence = {
      detected: Boolean(rec.detected),
      confidence: typeof rec.confidence === "number" ? Math.min(1, Math.max(0, rec.confidence)) : 0.5,
    };

    if (rec.detected) {
      result.recurrence.pattern = validateRecurrencePattern(rec.pattern);
      if (Array.isArray(rec.daysOfWeek)) {
        result.recurrence.daysOfWeek = rec.daysOfWeek
          .filter((d): d is string => typeof d === "string")
          .map((d) => d.slice(0, 20));
      }
    }
  }

  // Parse participants
  if (Array.isArray(scheduling.participants)) {
    result.participants = scheduling.participants
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.slice(0, 100));
  }

  return result;
}

// ============================================
// SAVE ACTION ITEMS
// ============================================

/**
 * Parse relative due date into actual Date
 */
function parseDueDate(dueDateStr: string | undefined): Date | null {
  if (!dueDateStr) return null;

  const lower = dueDateStr.toLowerCase();
  const now = new Date();

  // Handle relative dates
  if (lower === "today") {
    return now;
  }
  if (lower === "tomorrow") {
    return addDays(now, 1);
  }
  if (lower.includes("next week")) {
    return addDays(now, 7);
  }
  if (lower.includes("next monday")) {
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    return addDays(now, daysUntilMonday);
  }
  if (lower.includes("next friday")) {
    const daysUntilFriday = (12 - now.getDay()) % 7 || 7;
    return addDays(now, daysUntilFriday);
  }
  if (lower.match(/in (\d+) days?/)) {
    const match = lower.match(/in (\d+) days?/);
    if (match) {
      return addDays(now, parseInt(match[1], 10));
    }
  }
  if (lower.match(/(\d+) weeks?/)) {
    const match = lower.match(/(\d+) weeks?/);
    if (match) {
      return addDays(now, parseInt(match[1], 10) * 7);
    }
  }

  // Try parsing as ISO date
  const parsed = new Date(dueDateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Default: 1 week from now
  return addDays(now, 7);
}

/**
 * Save extracted action items to database and create reminders
 */
export async function saveActionItems(
  callId: string,
  orgId: string,
  clientId: string,
  items: ExtractedActionItem[],
  caseManagerId?: string
): Promise<void> {
  for (const item of items) {
    const dueDate = parseDueDate(item.dueDate);

    // Determine assignee
    let assigneeUserId: string | undefined;
    let assigneeRole = item.assigneeRole;

    if (assigneeRole === "CASE_MANAGER" && caseManagerId) {
      assigneeUserId = caseManagerId;
    }

    // Convert numeric priority to string
    const priorityStr = item.priority === 1 ? "HIGH" : item.priority === 3 ? "LOW" : "NORMAL";

    // Create action item
    const actionItem = await prisma.callActionItem.create({
      data: {
        callId,
        orgId,
        description: item.description,
        assigneeName: item.assigneeName,
        assigneeUserId,
        assigneeRole,
        dueDate,
        priority: priorityStr,
        contextSnippet: item.contextSnippet,
        timestampSeconds: item.timestampSeconds,
        aiConfidence: item.confidence,
        source: ActionItemSource.CALL_TRANSCRIPT,
        status: ActionItemStatus.OPEN,
      },
    });

    // Auto-create reminder if due date exists and assigned to case manager
    if (dueDate && assigneeUserId) {
      try {
        await createReminder({
          orgId,
          clientId,
          assignedToId: assigneeUserId,
          title: item.description.slice(0, 200),
          description: `Action item from call: ${item.contextSnippet || item.description}`,
          dueDate,
          priority: item.priority ?? 2,
        });
      } catch (error) {
        console.error("Error creating reminder for action item:", error);
        // Don't fail the whole operation if reminder creation fails
      }
    }
  }
}

// ============================================
// FULL PIPELINE
// ============================================

/**
 * Extract and save action items from a call
 */
export async function processCallActionItems(
  callId: string,
  transcript: string
): Promise<ExtractedActionItem[]> {
  // Get call details including client's orgId
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      clientId: true,
      caseManagerId: true,
      client: {
        select: { orgId: true },
      },
    },
  });

  if (!call) {
    throw new Error(`Call ${callId} not found`);
  }

  // Extract action items
  const { items } = await extractActionItems(transcript);

  if (items.length === 0) {
    return [];
  }

  // Save to database and create reminders
  await saveActionItems(
    callId,
    call.client.orgId,
    call.clientId,
    items,
    call.caseManagerId
  );

  return items;
}
