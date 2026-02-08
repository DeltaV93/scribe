import { anthropic, EXTRACTION_MODEL } from "./client";
import { prisma } from "@/lib/db";
import { ActionItemStatus, ActionItemSource } from "@prisma/client";
import { createReminder } from "@/lib/services/reminders";
import { addDays } from "date-fns";

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
