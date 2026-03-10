import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { processConversation, reprocessConversation } from "@/lib/services/conversation-processing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/conversations/:id/process - Trigger processing
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Get conversation status
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        recordingUrl: true,
        aiProcessingStatus: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (!conversation.recordingUrl) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No recording available to process" } },
        { status: 400 }
      );
    }

    // Reprocess if requested or already processed
    const reprocess = body.reprocess || conversation.status === "COMPLETED" || conversation.status === "REVIEW";

    let result;
    if (reprocess) {
      result = await reprocessConversation(id);
    } else {
      result = await processConversation(id);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "PROCESSING_ERROR", message: result.error } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      conversationId: id,
      status: result.success ? "processing_complete" : "processing_failed",
      results: {
        flaggedSegments: result.sensitivityResults?.flaggedCount || 0,
        actionItems: result.outputs?.actionItems.length || 0,
        calendarEvents: result.outputs?.calendarEvents.length || 0,
        goalUpdates: result.outputs?.goalUpdates.length || 0,
      },
    });
  } catch (error) {
    console.error("Error processing conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process conversation" } },
      { status: 500 }
    );
  }
}
