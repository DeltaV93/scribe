import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createDraftGoal } from "@/lib/services/goals";
import { GoalType } from "@prisma/client";
import { z } from "zod";

// Validation schema for new goal data
const newGoalDataSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  type: z.nativeEnum(GoalType),
  ownerId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  startDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  endDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
});

// Validation schema for resolving a goal match decision
const resolveSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link_existing"),
    existingGoalId: z.string().uuid().optional(),
    goalId: z.string().uuid().optional(), // Alternative field name for compatibility
  }),
  z.object({
    action: z.literal("create_new"),
    newGoalData: newGoalDataSchema.optional(),
    newGoal: newGoalDataSchema.optional(), // Alternative field name for compatibility
  }),
  z.object({
    action: z.literal("dismiss"),
  }),
]);

interface RouteParams {
  params: Promise<{ callId: string; draftId: string }>;
}

/**
 * POST /api/calls/[callId]/goal-drafts/[draftId]/resolve
 * Resolve a goal match decision for a call goal draft
 *
 * Actions:
 * - link_existing: Link the draft to an existing goal
 * - create_new: Create a new draft goal and link it
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId, draftId } = await params;

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        client: {
          orgId: user.orgId,
        },
      },
      select: {
        id: true,
        client: {
          select: {
            orgId: true,
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Verify draft exists and belongs to this call
    const draft = await prisma.callGoalDraft.findFirst({
      where: {
        id: draftId,
        callId,
      },
      select: {
        id: true,
        callId: true,
        goalId: true,
        draftGoalId: true,
        status: true,
        mappingType: true,
        detectedGoalText: true,
        suggestedName: true,
        suggestedDescription: true,
        suggestedType: true,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal draft not found" } },
        { status: 404 }
      );
    }

    // Only pending drafts can be resolved
    if (draft.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Draft has already been processed" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = resolveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    if (data.action === "dismiss") {
      // Dismiss/reject the draft
      await prisma.callGoalDraft.update({
        where: { id: draftId },
        data: {
          status: "REJECTED",
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          action: "dismiss",
          message: "Goal draft dismissed",
        },
      });
    }

    if (data.action === "link_existing") {
      // Support both existingGoalId and goalId field names
      const targetGoalId = data.existingGoalId || data.goalId;

      if (!targetGoalId) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "goalId or existingGoalId is required" } },
          { status: 400 }
        );
      }

      // Verify the existing goal belongs to the same org
      const existingGoal = await prisma.goal.findFirst({
        where: {
          id: targetGoalId,
          orgId: user.orgId,
          archivedAt: null,
        },
        select: { id: true, name: true },
      });

      if (!existingGoal) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Target goal not found" } },
          { status: 404 }
        );
      }

      // Update the draft to link to the existing goal
      await prisma.callGoalDraft.update({
        where: { id: draftId },
        data: {
          goalId: targetGoalId,
          selectedMatchId: targetGoalId,
          mappingType: "manual",
          isNewGoalDraft: false,
          draftGoalId: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          action: "link_existing",
          goalId: targetGoalId,
          goalName: existingGoal.name,
        },
      });
    }

    if (data.action === "create_new") {
      // Support both newGoalData and newGoal field names
      const newGoalData = data.newGoalData || data.newGoal;

      if (!newGoalData) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "newGoalData or newGoal is required" } },
          { status: 400 }
        );
      }

      const draftGoal = await createDraftGoal({
        orgId: user.orgId,
        createdById: user.id,
        name: newGoalData.name,
        description: newGoalData.description,
        type: newGoalData.type,
        sourceCallId: callId,
        visibility: "PRIVATE", // Default to private for draft goals
      });

      // Update the call goal draft to reference the new draft goal
      await prisma.callGoalDraft.update({
        where: { id: draftId },
        data: {
          goalId: null, // No existing goal linked
          draftGoalId: draftGoal.id,
          isNewGoalDraft: true,
          mappingType: "manual",
          selectedMatchId: null,
        },
      });

      // Create a DraftGoalCallMention to track this relationship
      await prisma.draftGoalCallMention.create({
        data: {
          goalId: draftGoal.id,
          callId,
          mentionedText: draft.detectedGoalText || newGoalData.name,
          confidence: 1.0, // Manual creation has full confidence
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          action: "create_new",
          draftGoalId: draftGoal.id,
          goalName: draftGoal.name,
        },
      });
    }
  } catch (error) {
    console.error("Error resolving goal draft:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to resolve goal draft",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
