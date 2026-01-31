/**
 * Meeting Action Items API
 *
 * GET /api/meetings/[meetingId]/action-items - Get action items for a meeting
 * PUT /api/meetings/[meetingId]/action-items - Update an action item
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateActionItemStatus } from "@/lib/services/meetings";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

/**
 * Get action items for a meeting
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;

    // Verify meeting exists and belongs to org
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, orgId: user.orgId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Meeting not found" } },
        { status: 404 }
      );
    }

    const actionItems = await prisma.meetingActionItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
      include: {
        assigneeUser: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: actionItems });
  } catch (error) {
    console.error("Error getting action items:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get action items" } },
      { status: 500 }
    );
  }
}

/**
 * Update an action item's status
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;
    const body = await request.json();

    if (!body.actionItemId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "actionItemId is required" } },
        { status: 400 }
      );
    }

    if (!body.status || !["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(body.status)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid status is required (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)" } },
        { status: 400 }
      );
    }

    // Verify the action item belongs to this meeting and org
    const actionItem = await prisma.meetingActionItem.findFirst({
      where: {
        id: body.actionItemId,
        meetingId,
        meeting: { orgId: user.orgId },
      },
    });

    if (!actionItem) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        { status: 404 }
      );
    }

    const updated = await updateActionItemStatus(
      body.actionItemId,
      body.status,
      body.status === "COMPLETED" ? user.id : undefined
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating action item:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update action item" } },
      { status: 500 }
    );
  }
}
