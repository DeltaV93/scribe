/**
 * Call Goal Drafts Service
 *
 * Handles creation, review, and approval of goal updates from call AI processing.
 * Supports hybrid goal mapping: client-linked + topic-matched goals.
 */

import { prisma } from "@/lib/db";
import { GoalStatus } from "@prisma/client";
import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import type { CallSummary } from "@/lib/ai/summary";

// ============================================
// TYPES
// ============================================

export interface RichProgressNotes {
  type: "call_context";
  callId: string;
  clientName: string;
  narrative: string;
  actionItems: string[];
  keyPoints: string[];
  sentiment?: string;
  topics: string[];
  mappingType: string;
  expandable: true;
}

export interface CallGoalDraftInput {
  callId: string;
  goalId: string;
  narrative: string;
  actionItems: string[];
  keyPoints: string[];
  sentiment?: string;
  topics: string[];
  mappingType: "client_linked" | "topic_matched" | "manual";
  confidence: number;
}

export interface DraftApprovalResult {
  success: boolean;
  progressId?: string;
  error?: string;
}

// ============================================
// GOAL MAPPING
// ============================================

/**
 * Find goals linked to a client via their program enrollments
 * Path: Client -> ProgramEnrollments -> Programs -> GoalProgramLinks -> Goals
 */
export async function findClientLinkedGoals(
  clientId: string,
  orgId: string
): Promise<string[]> {
  const enrollments = await prisma.programEnrollment.findMany({
    where: { clientId },
    select: {
      program: {
        select: {
          goalLinks: {
            select: { goalId: true },
          },
        },
      },
    },
  });

  // Flatten to unique goal IDs
  const goalIds = new Set<string>();
  for (const enrollment of enrollments) {
    for (const link of enrollment.program.goalLinks) {
      goalIds.add(link.goalId);
    }
  }

  // Verify goals exist and are active in this org
  if (goalIds.size === 0) return [];

  const activeGoals = await prisma.goal.findMany({
    where: {
      id: { in: Array.from(goalIds) },
      orgId,
      archivedAt: null,
      status: { not: GoalStatus.COMPLETED },
    },
    select: { id: true },
  });

  return activeGoals.map((g) => g.id);
}

/**
 * Find goals that match call topics using AI scoring
 * Returns goals with confidence > 0.6
 */
export async function findTopicMatchedGoals(
  topics: string[],
  orgId: string,
  excludeGoalIds: string[]
): Promise<Array<{ goalId: string; confidence: number }>> {
  if (topics.length === 0) return [];

  // Fetch all active, non-excluded goals in org
  const goals = await prisma.goal.findMany({
    where: {
      orgId,
      archivedAt: null,
      status: { not: GoalStatus.COMPLETED },
      id: { notIn: excludeGoalIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (goals.length === 0) return [];

  // Use AI to score topic relevance
  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: `You are analyzing whether call topics relate to organizational goals.
For each goal, score how relevant the discussed topics are on a scale of 0-1.
Only include goals with relevance > 0.6.
Return JSON: { "matches": [{ "goalId": "...", "confidence": 0.8 }] }`,
      messages: [
        {
          role: "user",
          content: `Topics discussed in call: ${topics.join(", ")}

Goals to evaluate:
${goals.map((g) => `- ID: ${g.id}\n  Name: ${g.name}\n  Description: ${g.description || "No description"}`).join("\n\n")}

Which goals are relevant to these topics? Return only goals with confidence > 0.6.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") return [];

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      matches: Array<{ goalId: string; confidence: number }>;
    };

    return parsed.matches.filter(
      (m) => m.confidence > 0.6 && goals.some((g) => g.id === m.goalId)
    );
  } catch (error) {
    console.error("[CallGoalDrafts] Error matching topics to goals:", error);
    return [];
  }
}

/**
 * Find all applicable goals for a call
 * Combines client-linked and topic-matched goals
 */
export async function findApplicableGoals(
  clientId: string,
  orgId: string,
  topics: string[]
): Promise<Array<{ goalId: string; mappingType: string; confidence: number }>> {
  // Get client-linked goals first
  const clientLinkedGoalIds = await findClientLinkedGoals(clientId, orgId);
  const results: Array<{ goalId: string; mappingType: string; confidence: number }> =
    clientLinkedGoalIds.map((goalId) => ({
      goalId,
      mappingType: "client_linked",
      confidence: 1.0, // Client-linked goals have full confidence
    }));

  // Get topic-matched goals (excluding already-linked)
  const topicMatches = await findTopicMatchedGoals(topics, orgId, clientLinkedGoalIds);
  for (const match of topicMatches) {
    results.push({
      goalId: match.goalId,
      mappingType: "topic_matched",
      confidence: match.confidence,
    });
  }

  return results;
}

// ============================================
// NARRATIVE GENERATION
// ============================================

/**
 * Generate a goal-specific narrative from call summary
 */
export async function generateGoalNarrative(
  goal: { name: string; description: string | null },
  callSummary: CallSummary,
  clientName: string,
  relevantActionItems: string[],
  relevantKeyPoints: string[]
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 256,
      system: `You are generating concise progress updates for organizational goals based on client calls.
Write 2-3 sentences max. Be factual, professional, and specific.
Always mention the client by name.`,
      messages: [
        {
          role: "user",
          content: `Generate a progress update for this goal based on a recent call.

Goal: ${goal.name}
${goal.description ? `Goal Description: ${goal.description}` : ""}

Call Summary: ${callSummary.overview}

Client Name: ${clientName}

${relevantActionItems.length > 0 ? `Relevant Action Items:\n${relevantActionItems.map((a) => `- ${a}`).join("\n")}` : ""}

${relevantKeyPoints.length > 0 ? `Key Points:\n${relevantKeyPoints.map((k) => `- ${k}`).join("\n")}` : ""}

Write a natural, professional update (2-3 sentences max) that:
1. Mentions ${clientName} by name
2. Describes what was discussed/accomplished relevant to this goal
3. Notes any important next steps

Keep it factual and concise.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return `Call completed with ${clientName} regarding ${goal.name}.`;
    }

    return textContent.text.trim();
  } catch (error) {
    console.error("[CallGoalDrafts] Error generating narrative:", error);
    return `Call completed with ${clientName} regarding ${goal.name}.`;
  }
}

// ============================================
// DRAFT CREATION
// ============================================

/**
 * Create goal drafts from a completed call
 * Called after AI processing completes
 */
export async function createDraftsFromCall(
  callId: string
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  try {
    // Fetch call with AI summary and client info
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        aiSummary: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            orgId: true,
          },
        },
      },
    });

    if (!call || !call.aiSummary) {
      return { created: 0, errors: ["Call or AI summary not found"] };
    }

    const summary = call.aiSummary as unknown as CallSummary;
    const clientName = `${call.client.firstName} ${call.client.lastName}`;

    // Find applicable goals
    const applicableGoals = await findApplicableGoals(
      call.client.id,
      call.client.orgId,
      summary.topics || []
    );

    if (applicableGoals.length === 0) {
      console.log(`[CallGoalDrafts] No applicable goals found for call ${callId}`);
      return { created: 0, errors: [] };
    }

    // Fetch goal details for narrative generation
    const goalIds = applicableGoals.map((g) => g.goalId);
    const goals = await prisma.goal.findMany({
      where: { id: { in: goalIds } },
      select: { id: true, name: true, description: true },
    });

    const goalMap = new Map(goals.map((g) => [g.id, g]));

    // Create drafts for each goal
    for (const { goalId, mappingType, confidence } of applicableGoals) {
      const goal = goalMap.get(goalId);
      if (!goal) continue;

      try {
        // Filter action items and key points relevant to this goal
        // For simplicity, include all - in production you might use AI filtering
        const relevantActionItems = summary.actionItems || [];
        const relevantKeyPoints = summary.keyPoints || [];

        // Generate goal-specific narrative
        const narrative = await generateGoalNarrative(
          goal,
          summary,
          clientName,
          relevantActionItems,
          relevantKeyPoints
        );

        // Create draft (upsert to handle re-processing)
        await prisma.callGoalDraft.upsert({
          where: {
            callId_goalId: { callId, goalId },
          },
          create: {
            callId,
            goalId,
            narrative,
            actionItems: relevantActionItems,
            keyPoints: relevantKeyPoints,
            sentiment: summary.clientSentiment,
            topics: summary.topics || [],
            mappingType,
            confidence,
            status: "PENDING",
          },
          update: {
            narrative,
            actionItems: relevantActionItems,
            keyPoints: relevantKeyPoints,
            sentiment: summary.clientSentiment,
            topics: summary.topics || [],
            mappingType,
            confidence,
            status: "PENDING", // Reset to pending on re-process
            reviewedById: null,
            reviewedAt: null,
            editedContent: null,
          },
        });

        created++;
      } catch (error) {
        const msg = `Failed to create draft for goal ${goalId}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[CallGoalDrafts] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[CallGoalDrafts] Created ${created} drafts for call ${callId}`);
    return { created, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CallGoalDrafts] Error creating drafts for call ${callId}:`, error);
    return { created, errors: [msg] };
  }
}

// ============================================
// DRAFT REVIEW & APPROVAL
// ============================================

/**
 * Get pending drafts for a goal
 */
export async function getPendingDraftsForGoal(
  goalId: string
): Promise<
  Array<{
    id: string;
    callId: string;
    narrative: string;
    actionItems: string[];
    keyPoints: string[];
    sentiment: string | null;
    topics: string[];
    mappingType: string;
    confidence: number;
    createdAt: Date;
    clientName: string;
    callDate: Date;
  }>
> {
  const drafts = await prisma.callGoalDraft.findMany({
    where: {
      goalId,
      status: "PENDING",
    },
    include: {
      call: {
        select: {
          startedAt: true,
          client: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return drafts.map((d) => ({
    id: d.id,
    callId: d.callId,
    narrative: d.narrative,
    actionItems: d.actionItems as string[],
    keyPoints: d.keyPoints as string[],
    sentiment: d.sentiment,
    topics: d.topics as string[],
    mappingType: d.mappingType,
    confidence: d.confidence,
    createdAt: d.createdAt,
    clientName: `${d.call.client.firstName} ${d.call.client.lastName}`,
    callDate: d.call.startedAt,
  }));
}

/**
 * Get count of pending drafts for a goal
 */
export async function getPendingDraftCount(goalId: string): Promise<number> {
  return prisma.callGoalDraft.count({
    where: { goalId, status: "PENDING" },
  });
}

/**
 * Approve a draft and create GoalProgress record
 */
export async function approveDraft(
  draftId: string,
  reviewerId: string,
  editedNarrative?: string
): Promise<DraftApprovalResult> {
  try {
    const draft = await prisma.callGoalDraft.findUnique({
      where: { id: draftId },
      include: {
        call: {
          select: {
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        goal: {
          select: {
            progress: true,
            status: true,
          },
        },
      },
    });

    if (!draft) {
      return { success: false, error: "Draft not found" };
    }

    if (draft.status !== "PENDING") {
      return { success: false, error: "Draft already processed" };
    }

    const finalNarrative = editedNarrative || draft.narrative;
    const clientName = `${draft.call.client.firstName} ${draft.call.client.lastName}`;

    // Create rich notes JSON
    const richNotes: RichProgressNotes = {
      type: "call_context",
      callId: draft.callId,
      clientName,
      narrative: finalNarrative,
      actionItems: draft.actionItems as string[],
      keyPoints: draft.keyPoints as string[],
      sentiment: draft.sentiment || undefined,
      topics: draft.topics as string[],
      mappingType: draft.mappingType,
      expandable: true,
    };

    // Transaction: update draft status and create progress record
    const result = await prisma.$transaction(async (tx) => {
      // Update draft
      await tx.callGoalDraft.update({
        where: { id: draftId },
        data: {
          status: editedNarrative ? "EDITED" : "APPROVED",
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          editedContent: editedNarrative || null,
        },
      });

      // Create GoalProgress record with rich notes
      const progress = await tx.goalProgress.create({
        data: {
          goalId: draft.goalId,
          previousValue: draft.goal.progress,
          newValue: draft.goal.progress, // No progress change from call alone
          previousStatus: draft.goal.status,
          newStatus: draft.goal.status,
          triggerType: "child_update",
          triggerSource: `call:${draft.callId}`,
          notes: JSON.stringify(richNotes),
          recordedById: reviewerId,
        },
      });

      return progress;
    });

    return { success: true, progressId: result.id };
  } catch (error) {
    console.error("[CallGoalDrafts] Error approving draft:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject a draft
 */
export async function rejectDraft(
  draftId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const draft = await prisma.callGoalDraft.findUnique({
      where: { id: draftId },
      select: { status: true },
    });

    if (!draft) {
      return { success: false, error: "Draft not found" };
    }

    if (draft.status !== "PENDING") {
      return { success: false, error: "Draft already processed" };
    }

    await prisma.callGoalDraft.update({
      where: { id: draftId },
      data: {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[CallGoalDrafts] Error rejecting draft:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if a progress notes string is rich call context
 */
export function isRichCallContext(notes: string | null): boolean {
  if (!notes) return false;
  try {
    const parsed = JSON.parse(notes);
    return parsed.type === "call_context";
  } catch {
    return false;
  }
}

/**
 * Parse rich call context from notes
 */
export function parseRichCallContext(notes: string): RichProgressNotes | null {
  try {
    const parsed = JSON.parse(notes);
    if (parsed.type === "call_context") {
      return parsed as RichProgressNotes;
    }
    return null;
  } catch {
    return null;
  }
}
