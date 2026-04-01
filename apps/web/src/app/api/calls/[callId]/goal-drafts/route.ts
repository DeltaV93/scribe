import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/[callId]/goal-drafts - Get pending goal drafts for a call
 *
 * Returns drafts that need resolution (pending matching or approval)
 * Two types:
 * 1. Drafts with goalId but status PENDING - need approval/rejection
 * 2. Drafts with detectedGoalText but no goalId - need goal matching
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    // Verify call exists and user has access
    const call = await prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        caseManagerId: true,
        client: {
          select: {
            orgId: true,
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Check organization match
    if (call.client.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Case managers can only view their own calls
    if (user.role === UserRole.CASE_MANAGER && call.caseManagerId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Fetch pending goal drafts for this call
    const drafts = await prisma.callGoalDraft.findMany({
      where: {
        callId,
        status: "PENDING",
      },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
          },
        },
        call: {
          select: {
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Separate into two categories
    const needsGoalResolution = drafts
      .filter((d) => d.detectedGoalText && !d.goalId)
      .map((d) => ({
        id: d.id,
        detectedGoalText: d.detectedGoalText,
        matchCandidates: d.matchCandidates as Array<{
          goalId: string;
          goalName: string;
          similarity: number;
        }> | null,
        suggestedGoal: d.suggestedName
          ? {
              name: d.suggestedName,
              description: d.suggestedDescription,
              type: d.suggestedType,
              ownerId: d.suggestedOwnerId,
              teamId: d.suggestedTeamId,
              startDate: d.suggestedStartDate,
              endDate: d.suggestedEndDate,
            }
          : null,
        narrative: d.narrative,
        createdAt: d.createdAt,
        clientName: `${d.call.client.firstName} ${d.call.client.lastName}`,
      }));

    const needsApproval = drafts
      .filter((d) => d.goalId)
      .map((d) => ({
        id: d.id,
        goalId: d.goalId,
        goalName: d.goal?.name,
        narrative: d.narrative,
        actionItems: d.actionItems as string[],
        keyPoints: d.keyPoints as string[],
        sentiment: d.sentiment,
        topics: d.topics as string[],
        mappingType: d.mappingType,
        confidence: d.confidence,
        createdAt: d.createdAt,
        clientName: `${d.call.client.firstName} ${d.call.client.lastName}`,
      }));

    return NextResponse.json({
      success: true,
      data: {
        needsGoalResolution,
        needsApproval,
        totalPending: drafts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching goal drafts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch goal drafts" } },
      { status: 500 }
    );
  }
}
