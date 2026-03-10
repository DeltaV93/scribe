import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string; outputId: string }>;
}

/**
 * POST /api/conversations/:id/outputs/:outputId/reject
 */
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

    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    const updated = await prisma.draftedOutput.update({
      where: { id: outputId },
      data: {
        status: "REJECTED",
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      output: updated,
    });
  } catch (error) {
    console.error("Error rejecting output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to reject output" } },
      { status: 500 }
    );
  }
}
