import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createDraftGoal, canViewDraftGoal } from "@/lib/services/goals";
import { prisma } from "@/lib/db";
import { GoalStatus, GoalType } from "@prisma/client";
import { z } from "zod";

// Validation schema for creating a draft goal
const createDraftGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  type: z.nativeEnum(GoalType),
  sourceCallId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["PRIVATE", "TEAM", "USERS", "ROLE"]).optional(),
  visibleToUserIds: z.array(z.string().uuid()).optional(),
  visibleToTeamIds: z.array(z.string().uuid()).optional(),
  visibleToRoles: z.array(z.string()).optional(),
});

/**
 * GET /api/goals/drafts - List draft goals visible to user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
    const skip = (page - 1) * pageSize;

    // First, get all draft goals in the org
    const draftGoals = await prisma.goal.findMany({
      where: {
        orgId: user.orgId,
        status: GoalStatus.DRAFT,
        archivedAt: null,
      },
      include: {
        owner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        sourceCall: {
          select: {
            id: true,
            startedAt: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            mentioningCalls: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter to only those the user can view
    const visibleGoals: typeof draftGoals = [];
    for (const goal of draftGoals) {
      const canView = await canViewDraftGoal(user.id, goal.id);
      if (canView) {
        visibleGoals.push(goal);
      }
    }

    // Apply pagination after filtering
    const total = visibleGoals.length;
    const paginatedGoals = visibleGoals.slice(skip, skip + pageSize);

    // Transform the response
    const data = paginatedGoals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      type: goal.type,
      status: goal.status,
      createdAt: goal.createdAt,
      createdBy: goal.createdBy,
      owner: goal.owner,
      team: goal.team,
      sourceCall: goal.sourceCall
        ? {
            id: goal.sourceCall.id,
            startedAt: goal.sourceCall.startedAt,
            clientName: goal.sourceCall.client
              ? `${goal.sourceCall.client.firstName} ${goal.sourceCall.client.lastName}`
              : null,
          }
        : null,
      mentioningCallsCount: goal._count.mentioningCalls,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error listing draft goals:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to list draft goals",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/drafts - Create a draft goal
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createDraftGoalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    const draftGoal = await createDraftGoal({
      orgId: user.orgId,
      createdById: user.id,
      name: data.name,
      description: data.description,
      type: data.type,
      sourceCallId: data.sourceCallId,
      visibility: data.visibility,
      visibleToUserIds: data.visibleToUserIds,
      visibleToTeamIds: data.visibleToTeamIds,
      visibleToRoles: data.visibleToRoles,
    });

    return NextResponse.json(
      { success: true, data: draftGoal },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating draft goal:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create draft goal",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
