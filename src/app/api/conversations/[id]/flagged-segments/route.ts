import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/flagged-segments - Get flagged segments
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status"); // PENDING, APPROVED, OVERRIDDEN, DISMISSED

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
    if (status) {
      where.status = status;
    }

    const segments = await prisma.flaggedSegment.findMany({
      where,
      include: {
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({
      success: true,
      segments,
      pendingCount: segments.filter((s) => s.status === "PENDING").length,
    });
  } catch (error) {
    console.error("Error fetching flagged segments:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch flagged segments" } },
      { status: 500 }
    );
  }
}
