import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canAccessConversation } from "@/lib/services/conversation-access";
import {
  getSpeakerLabels,
  updateSpeakerLabels,
  getSpeakerStats,
  type SpeakerLabel,
  type SpeakerRole,
} from "@/lib/services/speaker-labeling";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/speakers
 *
 * Get speaker labels and statistics for a conversation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: conversationId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, conversationId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Verify org ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        orgId: true,
        transcriptJson: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Get labels and stats
    const labelsResult = await getSpeakerLabels(conversationId);
    const stats = getSpeakerStats(conversation.transcriptJson);

    return NextResponse.json({
      ...labelsResult,
      stats,
    });
  } catch (error) {
    console.error("[Speakers] GET Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to get speakers",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id/speakers
 *
 * Update speaker labels for a conversation.
 *
 * Body: { labels: Array<{ speakerId: string, role: "staff" | "client" | "other", name?: string }> }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: conversationId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, conversationId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Verify org ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        orgId: true,
        transcriptJson: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const { labels } = body as { labels?: unknown[] };

    if (!Array.isArray(labels)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "labels must be an array" } },
        { status: 400 }
      );
    }

    // Validate labels
    const validRoles: SpeakerRole[] = ["staff", "client", "other"];
    const validatedLabels: SpeakerLabel[] = [];

    for (const label of labels) {
      if (typeof label !== "object" || label === null) {
        return NextResponse.json(
          { error: { code: "INVALID_INPUT", message: "Each label must be an object" } },
          { status: 400 }
        );
      }

      const { speakerId, role, name, userId, clientId } = label as Record<string, unknown>;

      if (typeof speakerId !== "string" || !speakerId) {
        return NextResponse.json(
          { error: { code: "INVALID_INPUT", message: "speakerId is required" } },
          { status: 400 }
        );
      }

      if (typeof role !== "string" || !validRoles.includes(role as SpeakerRole)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_INPUT",
              message: `role must be one of: ${validRoles.join(", ")}`,
            },
          },
          { status: 400 }
        );
      }

      validatedLabels.push({
        speakerId,
        role: role as SpeakerRole,
        name: typeof name === "string" ? name : undefined,
        userId: typeof userId === "string" ? userId : undefined,
        clientId: typeof clientId === "string" ? clientId : undefined,
      });
    }

    // Update labels
    const result = await updateSpeakerLabels(conversationId, {
      labels: validatedLabels,
    });

    // Get stats for response
    const stats = getSpeakerStats(conversation.transcriptJson);

    return NextResponse.json({
      ...result,
      stats,
    });
  } catch (error) {
    console.error("[Speakers] PATCH Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to update speakers",
        },
      },
      { status: 500 }
    );
  }
}
