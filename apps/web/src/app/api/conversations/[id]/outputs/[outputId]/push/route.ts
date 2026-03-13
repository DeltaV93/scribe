/**
 * Push Output to External Platform (PX-882)
 *
 * POST /api/conversations/:id/outputs/:outputId/push
 *
 * Pushes an approved drafted output to its configured destination platform.
 * Supports: Linear, Notion, Jira, Google Calendar
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { pushOutputAndUpdateStatus } from "@/lib/services/conversation-push";

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

    // Get output and verify it belongs to this conversation
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

    // Must be approved first
    if (output.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Output must be approved before pushing",
          },
        },
        { status: 400 }
      );
    }

    // Must have a destination platform
    if (!output.destinationPlatform) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No destination platform configured",
          },
        },
        { status: 400 }
      );
    }

    const orgId = output.conversation.orgId;

    // Push and update status
    const result = await pushOutputAndUpdateStatus(outputId, {
      orgId,
      userId: user.id,
      conversationId: id,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: result.errorCode || "PUSH_FAILED",
            message: result.error || "Push failed",
          },
        },
        { status: 500 }
      );
    }

    // Get updated output
    const updated = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
    });

    return NextResponse.json({
      success: true,
      output: updated,
      externalId: result.externalId,
    });
  } catch (error) {
    console.error("Error pushing output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to push output" } },
      { status: 500 }
    );
  }
}
