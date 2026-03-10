import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/outputs - Get drafted outputs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status"); // PENDING, APPROVED, REJECTED, PUSHED, FAILED
    const outputType = searchParams.get("type"); // ACTION_ITEM, MEETING_NOTES, etc.

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const where: Record<string, unknown> = {
      conversationId: id,
    };
    if (status) where.status = status;
    if (outputType) where.outputType = outputType;

    const outputs = await prisma.draftedOutput.findMany({
      where,
      include: {
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { outputType: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Group by type for easier frontend consumption
    const grouped = {
      actionItems: outputs.filter((o) => o.outputType === "ACTION_ITEM"),
      meetingNotes: outputs.filter((o) => o.outputType === "MEETING_NOTES"),
      calendarEvents: outputs.filter((o) => o.outputType === "CALENDAR_EVENT"),
      goalUpdates: outputs.filter((o) => o.outputType === "GOAL_UPDATE"),
      delaySignals: outputs.filter((o) => o.outputType === "DELAY_SIGNAL"),
      documents: outputs.filter((o) => o.outputType === "DOCUMENT"),
    };

    return NextResponse.json({
      success: true,
      outputs,
      grouped,
      counts: {
        total: outputs.length,
        pending: outputs.filter((o) => o.status === "PENDING").length,
        approved: outputs.filter((o) => o.status === "APPROVED").length,
        pushed: outputs.filter((o) => o.status === "PUSHED").length,
      },
    });
  } catch (error) {
    console.error("Error fetching outputs:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch outputs" } },
      { status: 500 }
    );
  }
}
