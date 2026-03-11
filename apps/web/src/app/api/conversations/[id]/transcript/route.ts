import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation, logAccess } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/transcript - Get conversation transcript
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        transcriptRaw: true,
        transcriptJson: true,
        sensitivityTier: true,
        flaggedSegments: {
          where: {
            finalTier: "REDACTED",
          },
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (!conversation.transcriptRaw) {
      return NextResponse.json(
        { error: { code: "NOT_AVAILABLE", message: "Transcript not yet available" } },
        { status: 404 }
      );
    }

    // Log access
    await logAccess(id, user.id, "VIEW");

    // Filter out redacted segments from the response
    let segments = conversation.transcriptJson as Array<{
      startTime: number;
      endTime: number;
      text: string;
      speaker?: string;
    }> || [];

    const redactedRanges = conversation.flaggedSegments;
    if (redactedRanges.length > 0) {
      segments = segments.map((segment) => {
        const isRedacted = redactedRanges.some(
          (range) =>
            segment.startTime >= range.startTime && segment.endTime <= range.endTime
        );
        if (isRedacted) {
          return {
            ...segment,
            text: "[REDACTED]",
          };
        }
        return segment;
      });
    }

    return NextResponse.json({
      success: true,
      transcript: {
        raw: conversation.transcriptRaw,
        segments,
        hasRedactedContent: redactedRanges.length > 0,
      },
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch transcript" } },
      { status: 500 }
    );
  }
}
