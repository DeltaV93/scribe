import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById } from "@/lib/services/goals";
import { approveDraft, rejectDraft } from "@/lib/services/call-goal-drafts";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ goalId: string; draftId: string }>;
}

/**
 * GET /api/goals/[goalId]/drafts/[draftId] - Get a specific draft
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, draftId } = await params;

    // Verify goal exists and belongs to user's org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    const draft = await prisma.callGoalDraft.findUnique({
      where: { id: draftId },
      include: {
        call: {
          select: {
            startedAt: true,
            durationSeconds: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        reviewedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!draft || draft.goalId !== goalId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: draft.id,
        callId: draft.callId,
        goalId: draft.goalId,
        narrative: draft.narrative,
        actionItems: draft.actionItems,
        keyPoints: draft.keyPoints,
        sentiment: draft.sentiment,
        topics: draft.topics,
        mappingType: draft.mappingType,
        confidence: draft.confidence,
        status: draft.status,
        editedContent: draft.editedContent,
        reviewedAt: draft.reviewedAt,
        reviewedBy: draft.reviewedBy?.name,
        createdAt: draft.createdAt,
        clientName: `${draft.call.client.firstName} ${draft.call.client.lastName}`,
        callDate: draft.call.startedAt,
        callDuration: draft.call.durationSeconds,
      },
    });
  } catch (error) {
    console.error("Error fetching draft:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch draft" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/goals/[goalId]/drafts/[draftId] - Approve, reject, or edit a draft
 * Body: { action: "approve" | "reject" | "edit", editedNarrative?: string }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId, draftId } = await params;

    // Only admins, program managers, and case managers can review drafts
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER &&
      user.role !== UserRole.CASE_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to review drafts" } },
        { status: 403 }
      );
    }

    // Verify goal exists and belongs to user's org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    // Verify draft exists and belongs to this goal
    const draft = await prisma.callGoalDraft.findUnique({
      where: { id: draftId },
      select: { goalId: true, status: true },
    });

    if (!draft || draft.goalId !== goalId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Draft not found" } },
        { status: 404 }
      );
    }

    if (draft.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Draft has already been processed" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, editedNarrative } = body;

    if (!action || !["approve", "reject", "edit"].includes(action)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid action. Must be 'approve', 'reject', or 'edit'" } },
        { status: 400 }
      );
    }

    if (action === "edit" && !editedNarrative) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "editedNarrative required for edit action" } },
        { status: 400 }
      );
    }

    if (action === "reject") {
      const result = await rejectDraft(draftId, user.id);
      if (!result.success) {
        return NextResponse.json(
          { error: { code: "INTERNAL_ERROR", message: result.error || "Failed to reject draft" } },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: { status: "REJECTED" } });
    }

    // Approve or edit (edit = approve with modified narrative)
    const result = await approveDraft(
      draftId,
      user.id,
      action === "edit" ? editedNarrative : undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: result.error || "Failed to approve draft" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: action === "edit" ? "EDITED" : "APPROVED",
        progressId: result.progressId,
      },
    });
  } catch (error) {
    console.error("Error processing draft:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process draft" } },
      { status: 500 }
    );
  }
}
