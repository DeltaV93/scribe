/**
 * Call Goal Drafts Service
 *
 * Handles creation, review, and approval of goal updates from call AI processing.
 * Supports hybrid goal mapping: client-linked + embedding-matched + topic-matched goals.
 */

import { prisma } from "@/lib/db";
import { GoalStatus, GoalType, Prisma } from "@prisma/client";
import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import type { CallSummary } from "@/lib/ai/summary";
import mlServices from "@/lib/ml-services/client";

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
  mappingType: "client_linked" | "topic_matched" | "embedding_matched" | "manual" | "pending";
  confidence: number;
}

export interface EmbeddingMatchResult {
  goalId: string;
  goalName: string;
  similarity: number;
  mappingType: "embedding_matched";
}

export interface SuggestedGoalFields {
  suggestedName: string;
  suggestedDescription: string;
  suggestedType: GoalType;
  suggestedOwnerId?: string;
  suggestedTeamId?: string;
  suggestedStartDate?: Date;
  suggestedEndDate?: Date;
}

export interface DraftWithMatchCandidatesResult {
  draftId: string;
  matchCandidates: Array<{ goalId: string; goalName: string; similarity: number }>;
  suggestedGoal: SuggestedGoalFields;
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
 * @deprecated Use findGoalMatchesWithEmbeddings instead.
 * This function uses Claude API which is expensive for topic matching.
 * Kept as fallback if ML service is unavailable.
 *
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
 * Find goals that match call topics using embedding-based similarity
 * Uses the ML service for efficient vector similarity search
 * Returns goals with similarity > 0.6
 */
export async function findGoalMatchesWithEmbeddings(
  topics: string[],
  callSummary: string,
  orgId: string,
  excludeGoalIds: string[]
): Promise<EmbeddingMatchResult[]> {
  // Combine topics and summary into query text for embedding
  const queryText = [
    ...topics,
    callSummary,
  ].filter(Boolean).join(". ");

  if (!queryText.trim()) return [];

  try {
    // Fetch all active, non-excluded goals with embeddings
    const goals = await prisma.goal.findMany({
      where: {
        orgId,
        archivedAt: null,
        status: { notIn: [GoalStatus.COMPLETED, GoalStatus.DRAFT] },
        id: { notIn: excludeGoalIds },
        embedding: { not: Prisma.DbNull },
      },
      select: {
        id: true,
        name: true,
        description: true,
        embedding: true,
      },
    });

    if (goals.length === 0) {
      console.log("[CallGoalDrafts] No goals with embeddings found for matching");
      return [];
    }

    // Prepare candidates for ML service
    const candidates = goals.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || undefined,
      embedding: g.embedding as number[],
    }));

    // Call ML service for similarity search
    const response = await mlServices.goalEmbeddings.findSimilar({
      query_text: queryText,
      candidates,
      threshold: 0.6,
      top_k: 10, // Return top 10 matches
    });

    return response.matches.map((match) => ({
      goalId: match.goal_id,
      goalName: match.goal_name,
      similarity: match.similarity,
      mappingType: "embedding_matched" as const,
    }));
  } catch (error) {
    // Handle ML service errors gracefully - fall back to empty array
    console.error("[CallGoalDrafts] Error in embedding-based goal matching:", error);
    console.log("[CallGoalDrafts] ML service unavailable, returning empty matches");
    return [];
  }
}

/**
 * Generate AI suggestions for a new goal based on detected goal text
 */
async function generateGoalSuggestions(
  detectedGoalText: string,
  clientName: string,
  topics: string[]
): Promise<SuggestedGoalFields> {
  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: `You are helping create a goal from a conversation. Based on the detected goal text, suggest appropriate goal fields.
Return JSON with:
- suggestedName: A concise goal name (under 80 chars)
- suggestedDescription: A clear description of what success looks like
- suggestedType: One of: GRANT, KPI, OKR, PROGRAM_INITIATIVE, TEAM_INITIATIVE, INDIVIDUAL
  - Use INDIVIDUAL for client-specific goals
  - Use PROGRAM_INITIATIVE for program-level goals
  - Use TEAM_INITIATIVE for team-level goals
  - Use KPI for measurable metrics
  - Use OKR for objectives with key results
  - Use GRANT for grant-related goals

Be specific and actionable. Focus on measurable outcomes.`,
      messages: [
        {
          role: "user",
          content: `Detected goal text from call: "${detectedGoalText}"

Client: ${clientName}
Topics discussed: ${topics.join(", ")}

Generate suggested goal fields.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return getDefaultGoalSuggestions(detectedGoalText);
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return getDefaultGoalSuggestions(detectedGoalText);
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      suggestedName: string;
      suggestedDescription: string;
      suggestedType: string;
    };

    // Map string to GoalType enum
    const typeMap: Record<string, GoalType> = {
      GRANT: GoalType.GRANT,
      KPI: GoalType.KPI,
      OKR: GoalType.OKR,
      PROGRAM_INITIATIVE: GoalType.PROGRAM_INITIATIVE,
      TEAM_INITIATIVE: GoalType.TEAM_INITIATIVE,
      INDIVIDUAL: GoalType.INDIVIDUAL,
    };

    return {
      suggestedName: parsed.suggestedName || detectedGoalText.slice(0, 80),
      suggestedDescription: parsed.suggestedDescription || detectedGoalText,
      suggestedType: typeMap[parsed.suggestedType?.toUpperCase()] || GoalType.INDIVIDUAL,
    };
  } catch (error) {
    console.error("[CallGoalDrafts] Error generating goal suggestions:", error);
    return getDefaultGoalSuggestions(detectedGoalText);
  }
}

function getDefaultGoalSuggestions(detectedGoalText: string): SuggestedGoalFields {
  return {
    suggestedName: detectedGoalText.slice(0, 80),
    suggestedDescription: detectedGoalText,
    suggestedType: GoalType.INDIVIDUAL,
  };
}

/**
 * Find similar goals using embeddings for a given detected goal text
 * Helper function for createDraftWithMatchCandidates
 */
async function findSimilarGoals(
  detectedGoalText: string,
  orgId: string
): Promise<Array<{ goalId: string; goalName: string; similarity: number }>> {
  try {
    // Fetch goals with embeddings
    const goals = await prisma.goal.findMany({
      where: {
        orgId,
        archivedAt: null,
        status: { notIn: [GoalStatus.COMPLETED, GoalStatus.DRAFT] },
        embedding: { not: Prisma.DbNull },
      },
      select: {
        id: true,
        name: true,
        description: true,
        embedding: true,
      },
    });

    if (goals.length === 0) return [];

    const candidates = goals.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description || undefined,
      embedding: g.embedding as number[],
    }));

    const response = await mlServices.goalEmbeddings.findSimilar({
      query_text: detectedGoalText,
      candidates,
      threshold: 0.4, // Lower threshold to show more candidates for user selection
      top_k: 5,
    });

    return response.matches.map((match) => ({
      goalId: match.goal_id,
      goalName: match.goal_name,
      similarity: match.similarity,
    }));
  } catch (error) {
    console.error("[CallGoalDrafts] Error finding similar goals:", error);
    return [];
  }
}

/**
 * Create a draft with match candidates for user resolution
 * Used when a new goal is detected in a call that doesn't clearly match existing goals
 */
export async function createDraftWithMatchCandidates(
  callId: string,
  detectedGoalText: string,
  orgId: string,
  createdById: string
): Promise<DraftWithMatchCandidatesResult> {
  // Fetch call details for context
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      aiSummary: true,
    },
  });

  const clientName = call?.client
    ? `${call.client.firstName} ${call.client.lastName}`
    : "Unknown Client";

  const summary = call?.aiSummary as CallSummary | null;
  const topics = summary?.topics || [];

  // Find similar goals using embeddings
  const matchCandidates = await findSimilarGoals(detectedGoalText, orgId);

  // Generate AI suggestions for new goal fields
  const suggestedGoal = await generateGoalSuggestions(
    detectedGoalText,
    clientName,
    topics
  );

  // Create CallGoalDraft with pending status
  const draft = await prisma.callGoalDraft.create({
    data: {
      callId,
      goalId: null, // Pending resolution
      narrative: detectedGoalText, // Use detected text as initial narrative
      actionItems: [],
      keyPoints: [],
      sentiment: summary?.clientSentiment,
      topics,
      mappingType: "pending",
      confidence: 0,
      status: "PENDING",
      detectedGoalText,
      matchCandidates: matchCandidates,
      suggestedName: suggestedGoal.suggestedName,
      suggestedDescription: suggestedGoal.suggestedDescription,
      suggestedType: suggestedGoal.suggestedType,
      suggestedOwnerId: suggestedGoal.suggestedOwnerId,
      suggestedTeamId: suggestedGoal.suggestedTeamId,
      suggestedStartDate: suggestedGoal.suggestedStartDate,
      suggestedEndDate: suggestedGoal.suggestedEndDate,
    },
  });

  return {
    draftId: draft.id,
    matchCandidates,
    suggestedGoal,
  };
}

/**
 * Find all applicable goals for a call
 * Combines client-linked and embedding-matched goals
 */
export async function findApplicableGoals(
  clientId: string,
  orgId: string,
  topics: string[],
  callSummary?: string
): Promise<Array<{ goalId: string; mappingType: string; confidence: number }>> {
  // Get client-linked goals first
  const clientLinkedGoalIds = await findClientLinkedGoals(clientId, orgId);
  const results: Array<{ goalId: string; mappingType: string; confidence: number }> =
    clientLinkedGoalIds.map((goalId) => ({
      goalId,
      mappingType: "client_linked",
      confidence: 1.0, // Client-linked goals have full confidence
    }));

  // Get embedding-matched goals (excluding already-linked)
  const embeddingMatches = await findGoalMatchesWithEmbeddings(
    topics,
    callSummary || "",
    orgId,
    clientLinkedGoalIds
  );

  for (const match of embeddingMatches) {
    results.push({
      goalId: match.goalId,
      mappingType: "embedding_matched",
      confidence: match.similarity,
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

    // Find applicable goals using embedding-based matching
    const applicableGoals = await findApplicableGoals(
      call.client.id,
      call.client.orgId,
      summary.topics || [],
      summary.overview || ""
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

    if (!draft.goalId || !draft.goal) {
      return { success: false, error: "Draft has no linked goal" };
    }

    // Capture goal data for use in transaction closure
    const goalId = draft.goalId;
    const goalProgress = draft.goal.progress;
    const goalStatus = draft.goal.status;

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
          goalId,
          previousValue: goalProgress,
          newValue: goalProgress, // No progress change from call alone
          previousStatus: goalStatus,
          newStatus: goalStatus,
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
