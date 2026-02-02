/**
 * Action Items API
 *
 * GET /api/action-items - Get action items assigned to the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Get action items assigned to the current user
 *
 * Query params:
 * - status: Filter by status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
 * - limit: Number of items to return (default 50, max 100)
 * - offset: Number of items to skip (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get("status") as
      | "OPEN"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED"
      | null;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Validate status if provided
    if (
      status &&
      !["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Invalid status. Must be OPEN, IN_PROGRESS, COMPLETED, or CANCELLED",
          },
        },
        { status: 400 }
      );
    }

    // Build where clause to match action items assigned to the current user
    // Match by assigneeUserId or by name/email in assigneeName field
    const where: Prisma.MeetingActionItemWhereInput = {
      meeting: {
        orgId: user.orgId,
      },
      OR: [
        { assigneeUserId: user.id },
        ...(user.name ? [{ assigneeName: user.name }] : []),
        { assigneeName: user.email },
      ],
      ...(status && { status }),
    };

    // Fetch action items with meeting info
    const [actionItems, total] = await Promise.all([
      prisma.meetingActionItem.findMany({
        where,
        include: {
          meeting: {
            select: {
              id: true,
              title: true,
              actualStartAt: true,
              scheduledStartAt: true,
            },
          },
          assigneeUser: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          // Sort by due date (nulls last), then by created date
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.meetingActionItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: actionItems,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error getting user action items:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get action items",
        },
      },
      { status: 500 }
    );
  }
}
