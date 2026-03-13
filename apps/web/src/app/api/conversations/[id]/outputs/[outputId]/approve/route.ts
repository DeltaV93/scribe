/**
 * Approve Drafted Output (PX-882)
 *
 * POST /api/conversations/:id/outputs/:outputId/approve
 *
 * Approves a drafted output and optionally auto-pushes to the
 * destination platform if one is configured and connected.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { autoPushAfterApproval } from "@/lib/services/conversation-push";

interface RouteParams {
  params: Promise<{ id: string; outputId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, outputId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Get output with conversation info
    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
      include: {
        conversation: {
          select: { orgId: true },
        },
      },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    const orgId = output.conversation.orgId;

    // First, update status to APPROVED
    let updated = await prisma.draftedOutput.update({
      where: { id: outputId },
      data: {
        status: "APPROVED",
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    // Auto-push if destination platform is configured and connected
    const pushResult = await autoPushAfterApproval(outputId, {
      orgId,
      userId: user.id,
      conversationId: id,
    });

    // If push happened, get the updated output
    if (pushResult !== null) {
      updated = await prisma.draftedOutput.findUnique({
        where: { id: outputId },
      }) || updated;
    }

    return NextResponse.json({
      success: true,
      output: updated,
      // Include push result info for UI
      pushResult: pushResult
        ? {
            attempted: true,
            success: pushResult.success,
            externalId: pushResult.externalId,
            error: pushResult.error,
          }
        : {
            attempted: false,
            reason: output.destinationPlatform
              ? "Platform not connected"
              : "No destination platform configured",
          },
    });
  } catch (error) {
    console.error("Error approving output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to approve output" } },
      { status: 500 }
    );
  }
}
