import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConversationStatus, ConversationType, UserRole } from "@prisma/client";

/**
 * GET /api/conversations - List conversations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as ConversationStatus | null;
    const type = searchParams.get("type") as ConversationType | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build filters
    const where: Record<string, unknown> = {
      orgId: user.orgId,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.startedAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    // Non-admin users only see their own conversations or those they have access to
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      where.OR = [
        { createdById: user.id },
        {
          accessList: {
            some: {
              userId: user.id,
              revokedAt: null,
            },
          },
        },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          recoveryStatus: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          sensitivityTier: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              flaggedSegments: true,
              draftedOutputs: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list conversations" } },
      { status: 500 }
    );
  }
}
