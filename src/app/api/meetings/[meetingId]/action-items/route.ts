/**
 * Meeting Action Items API
 *
 * GET /api/meetings/[meetingId]/action-items - Get action items for a meeting
 * PUT /api/meetings/[meetingId]/action-items - Update an action item (status, assignee, due date)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
 * Update an action item
 *
 * Supports updating:
 * - status: OPEN, IN_PROGRESS, COMPLETED, CANCELLED
 * - assigneeUserId: User ID or null to unassign
 * - dueDate: ISO date string or null to clear
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

    // Build update data based on what was provided
    const updateData: Record<string, unknown> = {};

    // Handle status update
    if (body.status !== undefined) {
      if (!["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(body.status)) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Valid status is required (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)" } },
          { status: 400 }
        );
      }
      updateData.status = body.status;

      // Track completion
      if (body.status === "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.completedById = user.id;
      } else {
        updateData.completedAt = null;
        updateData.completedById = null;
      }
    }

    // Handle assignee update
    if (body.assigneeUserId !== undefined) {
      if (body.assigneeUserId === null) {
        // Unassign
        updateData.assigneeUserId = null;
      } else {
        // Verify the user exists and belongs to the same org
        const assignee = await prisma.user.findFirst({
          where: {
            id: body.assigneeUserId,
            orgId: user.orgId,
            isActive: true,
          },
          select: { id: true, name: true },
        });

        if (!assignee) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "Assignee not found in your organization" } },
            { status: 400 }
          );
        }

        updateData.assigneeUserId = body.assigneeUserId;
        // Also update the assigneeName to match the user's name
        if (assignee.name) {
          updateData.assigneeName = assignee.name;
        }
      }
    }

    // Handle due date update
    if (body.dueDate !== undefined) {
      if (body.dueDate === null) {
        updateData.dueDate = null;
      } else {
        // Parse the date string
        const dueDate = new Date(body.dueDate);
        if (isNaN(dueDate.getTime())) {
          return NextResponse.json(
            { error: { code: "VALIDATION_ERROR", message: "Invalid due date format" } },
            { status: 400 }
          );
        }
        updateData.dueDate = dueDate;
      }
    }

    // If no updates provided, return error
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No valid updates provided" } },
        { status: 400 }
      );
    }

    // Perform the update
    const updated = await prisma.meetingActionItem.update({
      where: { id: body.actionItemId },
      data: updateData,
      include: {
        assigneeUser: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating action item:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update action item" } },
      { status: 500 }
    );
  }
}
