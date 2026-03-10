import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import type { FlagReviewStatus, SensitivityTier } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string; segmentId: string }>;
}

/**
 * POST /api/conversations/:id/flagged-segments/:segmentId/review
 * Review a flagged segment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, segmentId } = await params;
    const body = await request.json();

    const { decision, finalTier, notes } = body as {
      decision: FlagReviewStatus;
      finalTier?: SensitivityTier;
      notes?: string;
    };

    if (!decision) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Decision is required" } },
        { status: 400 }
      );
    }

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Get the segment
    const segment = await prisma.flaggedSegment.findUnique({
      where: { id: segmentId },
      include: {
        conversation: {
          select: { orgId: true },
        },
      },
    });

    if (!segment || segment.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Segment not found" } },
        { status: 404 }
      );
    }

    // Determine final tier based on decision
    let determinedFinalTier: SensitivityTier;
    if (decision === "APPROVED") {
      determinedFinalTier = segment.suggestedTier;
    } else if (decision === "OVERRIDDEN" && finalTier) {
      determinedFinalTier = finalTier;
    } else if (decision === "DISMISSED") {
      determinedFinalTier = "STANDARD";
    } else {
      determinedFinalTier = segment.suggestedTier;
    }

    // Update segment
    const updated = await prisma.flaggedSegment.update({
      where: { id: segmentId },
      data: {
        status: decision,
        finalTier: determinedFinalTier,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    // Store decision for ML training
    await prisma.sensitivityDecision.create({
      data: {
        orgId: segment.conversation.orgId,
        segmentText: segment.text,
        predictedCategory: segment.category,
        predictedTier: segment.suggestedTier,
        actualTier: determinedFinalTier,
        isCorrect: decision === "APPROVED",
        isLocalModel: true,
      },
    });

    // Audit log
    await createAuditLog({
      orgId: segment.conversation.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "FLAGGED_SEGMENT",
      resourceId: segmentId,
      details: {
        conversationId: id,
        decision,
        suggestedTier: segment.suggestedTier,
        finalTier: determinedFinalTier,
        category: segment.category,
      },
    });

    // Check if all segments reviewed, update conversation status
    const pendingCount = await prisma.flaggedSegment.count({
      where: {
        conversationId: id,
        status: "PENDING",
      },
    });

    if (pendingCount === 0) {
      // Recalculate overall sensitivity tier
      const segments = await prisma.flaggedSegment.findMany({
        where: { conversationId: id },
        select: { finalTier: true },
      });

      let overallTier: SensitivityTier = "STANDARD";
      for (const seg of segments) {
        if (seg.finalTier === "REDACTED") {
          overallTier = "REDACTED";
          break;
        } else if (seg.finalTier === "RESTRICTED") {
          overallTier = "RESTRICTED";
        }
      }

      await prisma.conversation.update({
        where: { id },
        data: { sensitivityTier: overallTier },
      });
    }

    return NextResponse.json({
      success: true,
      segment: updated,
      pendingCount,
    });
  } catch (error) {
    console.error("Error reviewing segment:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to review segment" } },
      { status: 500 }
    );
  }
}
