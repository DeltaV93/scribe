import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGoalById, canViewDraftGoal } from "@/lib/services/goals";
import { prisma } from "@/lib/db";
import { GoalStatus } from "@prisma/client";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/[goalId]/visibility - Get draft goal visibility settings
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Verify goal exists and belongs to org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    // Verify goal is in draft status
    if (goal.status !== GoalStatus.DRAFT) {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Goal is not in draft status" } },
        { status: 400 }
      );
    }

    // Verify user can view this draft goal
    const canView = await canViewDraftGoal(user.id, goalId);
    if (!canView) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have access to this draft goal" } },
        { status: 403 }
      );
    }

    // Fetch visibility details
    const goalWithVisibility = await prisma.goal.findUnique({
      where: { id: goalId },
      select: {
        visibility: true,
        visibleToRoles: true,
        visibleToUsers: {
          select: {
            userId: true,
            canEdit: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        visibleToTeams: {
          select: {
            teamId: true,
            canEdit: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!goalWithVisibility) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        visibility: goalWithVisibility.visibility,
        visibleToRoles: goalWithVisibility.visibleToRoles,
        visibleToUsers: goalWithVisibility.visibleToUsers.map((v) => ({
          userId: v.userId,
          canEdit: v.canEdit,
          user: v.user,
        })),
        visibleToTeams: goalWithVisibility.visibleToTeams.map((v) => ({
          teamId: v.teamId,
          canEdit: v.canEdit,
          team: v.team,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching goal visibility:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch goal visibility",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}

// Validation schema for updating visibility
const updateVisibilitySchema = z.object({
  visibility: z.enum(["PRIVATE", "TEAM", "USERS", "ROLE"]).optional(),
  visibleToRoles: z.array(z.string()).optional(),
  addUserIds: z.array(z.string().uuid()).optional(),
  removeUserIds: z.array(z.string().uuid()).optional(),
  addTeamIds: z.array(z.string().uuid()).optional(),
  removeTeamIds: z.array(z.string().uuid()).optional(),
});

/**
 * PUT /api/goals/[goalId]/visibility - Update draft goal visibility settings
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { goalId } = await params;

    // Verify goal exists and belongs to org
    const goal = await getGoalById(goalId, user.orgId);
    if (!goal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Goal not found" } },
        { status: 404 }
      );
    }

    // Verify goal is in draft status
    if (goal.status !== GoalStatus.DRAFT) {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Goal is not in draft status" } },
        { status: 400 }
      );
    }

    // Only the creator can update visibility
    if (goal.createdById !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the creator can update visibility settings" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateVisibilitySchema.safeParse(body);

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

    const {
      visibility,
      visibleToRoles,
      addUserIds,
      removeUserIds,
      addTeamIds,
      removeTeamIds,
    } = validation.data;

    await prisma.$transaction(async (tx) => {
      // Update goal visibility fields
      const updateData: Record<string, unknown> = {};
      if (visibility !== undefined) {
        updateData.visibility = visibility;
      }
      if (visibleToRoles !== undefined) {
        updateData.visibleToRoles = visibleToRoles;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.goal.update({
          where: { id: goalId },
          data: updateData,
        });
      }

      // Remove user visibility
      if (removeUserIds && removeUserIds.length > 0) {
        await tx.goalUserVisibility.deleteMany({
          where: {
            goalId,
            userId: { in: removeUserIds },
          },
        });
      }

      // Add user visibility
      if (addUserIds && addUserIds.length > 0) {
        // Filter out users that already have visibility
        const existing = await tx.goalUserVisibility.findMany({
          where: {
            goalId,
            userId: { in: addUserIds },
          },
          select: { userId: true },
        });
        const existingIds = new Set(existing.map((e) => e.userId));
        const newUserIds = addUserIds.filter((id) => !existingIds.has(id));

        if (newUserIds.length > 0) {
          await tx.goalUserVisibility.createMany({
            data: newUserIds.map((userId) => ({
              goalId,
              userId,
              canEdit: false,
            })),
          });
        }
      }

      // Remove team visibility
      if (removeTeamIds && removeTeamIds.length > 0) {
        await tx.goalTeamVisibility.deleteMany({
          where: {
            goalId,
            teamId: { in: removeTeamIds },
          },
        });
      }

      // Add team visibility
      if (addTeamIds && addTeamIds.length > 0) {
        // Filter out teams that already have visibility
        const existing = await tx.goalTeamVisibility.findMany({
          where: {
            goalId,
            teamId: { in: addTeamIds },
          },
          select: { teamId: true },
        });
        const existingIds = new Set(existing.map((e) => e.teamId));
        const newTeamIds = addTeamIds.filter((id) => !existingIds.has(id));

        if (newTeamIds.length > 0) {
          await tx.goalTeamVisibility.createMany({
            data: newTeamIds.map((teamId) => ({
              goalId,
              teamId,
              canEdit: false,
            })),
          });
        }
      }
    });

    // Fetch and return updated visibility
    const updatedGoal = await prisma.goal.findUnique({
      where: { id: goalId },
      select: {
        visibility: true,
        visibleToRoles: true,
        visibleToUsers: {
          select: {
            userId: true,
            canEdit: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        visibleToTeams: {
          select: {
            teamId: true,
            canEdit: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        visibility: updatedGoal?.visibility,
        visibleToRoles: updatedGoal?.visibleToRoles,
        visibleToUsers: updatedGoal?.visibleToUsers.map((v) => ({
          userId: v.userId,
          canEdit: v.canEdit,
          user: v.user,
        })),
        visibleToTeams: updatedGoal?.visibleToTeams.map((v) => ({
          teamId: v.teamId,
          canEdit: v.canEdit,
          team: v.team,
        })),
      },
    });
  } catch (error) {
    console.error("Error updating goal visibility:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update goal visibility",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
