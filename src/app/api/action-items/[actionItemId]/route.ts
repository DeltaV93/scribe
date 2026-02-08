import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionItemStatus } from "@prisma/client";
import { z } from "zod";

// Validation schema for updating an action item
const updateActionItemSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  assigneeName: z.string().max(100).nullable().optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .nullable()
    .optional(),
  priority: z.number().int().min(1).max(3).optional(),
  status: z.nativeEnum(ActionItemStatus).optional(),
});

interface RouteParams {
  params: Promise<{ actionItemId: string }>;
}

/**
 * GET /api/action-items/[actionItemId] - Get an action item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { actionItemId } = await params;

    const actionItem = await prisma.callActionItem.findFirst({
      where: { id: actionItemId, orgId: user.orgId },
      include: {
        call: {
          select: { id: true, clientId: true },
        },
        assigneeUser: {
          select: { id: true, name: true, email: true },
        },
        completedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!actionItem) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    console.error("Error fetching action item:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch action item" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/action-items/[actionItemId] - Update an action item
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { actionItemId } = await params;

    // Verify action item exists and belongs to org
    const existing = await prisma.callActionItem.findFirst({
      where: { id: actionItemId, orgId: user.orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateActionItemSchema.safeParse(body);

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

    // Handle status transitions
    const updateData: Record<string, unknown> = {
      description: data.description,
      assigneeUserId: data.assigneeUserId,
      assigneeName: data.assigneeName,
      dueDate: data.dueDate,
      priority: data.priority,
      status: data.status,
    };

    // Set completion data if completing
    if (data.status === ActionItemStatus.COMPLETED && existing.status !== ActionItemStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.completedById = user.id;
    }

    // Clear completion data if reopening
    if (data.status && data.status !== ActionItemStatus.COMPLETED && existing.status === ActionItemStatus.COMPLETED) {
      updateData.completedAt = null;
      updateData.completedById = null;
    }

    const actionItem = await prisma.callActionItem.update({
      where: { id: actionItemId },
      data: updateData,
      include: {
        assigneeUser: {
          select: { id: true, name: true, email: true },
        },
        completedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: actionItem });
  } catch (error) {
    console.error("Error updating action item:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update action item" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/action-items/[actionItemId] - Delete an action item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { actionItemId } = await params;

    // Verify action item exists and belongs to org
    const existing = await prisma.callActionItem.findFirst({
      where: { id: actionItemId, orgId: user.orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Action item not found" } },
        { status: 404 }
      );
    }

    await prisma.callActionItem.delete({
      where: { id: actionItemId },
    });

    return NextResponse.json({
      success: true,
      message: "Action item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting action item:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete action item" } },
      { status: 500 }
    );
  }
}
