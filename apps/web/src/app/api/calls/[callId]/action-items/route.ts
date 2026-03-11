import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionItemStatus } from "@prisma/client";
import { processCallActionItems } from "@/lib/ai/call-action-items";
import { z } from "zod";

// Validation schema for creating a manual action item
const createActionItemSchema = z.object({
  description: z.string().min(1).max(500),
  assigneeUserId: z.string().uuid().optional(),
  assigneeName: z.string().max(100).optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((val) => new Date(val))
    .optional(),
  priority: z.number().int().min(1).max(3).optional(),
});

interface RouteParams {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/[callId]/action-items - List action items for a call
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: { id: callId, client: { orgId: user.orgId } },
      select: { id: true },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    const actionItems = await prisma.callActionItem.findMany({
      where: { callId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        assigneeUser: {
          select: { id: true, name: true, email: true },
        },
        completedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: actionItems,
    });
  } catch (error) {
    console.error("Error listing action items:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list action items" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls/[callId]/action-items - Create or extract action items
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: { id: callId, client: { orgId: user.orgId } },
      select: { id: true, transcriptRaw: true },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check if this is an extraction request or manual creation
    if (body.extract === true) {
      // Extract action items from transcript
      if (!call.transcriptRaw) {
        return NextResponse.json(
          { error: { code: "NO_TRANSCRIPT", message: "Call has no transcript to extract from" } },
          { status: 400 }
        );
      }

      const items = await processCallActionItems(callId, call.transcriptRaw);

      return NextResponse.json({
        success: true,
        data: { extracted: items.length, items },
      });
    } else {
      // Manual creation
      const validation = createActionItemSchema.safeParse(body);

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

      // Convert numeric priority to string
      const priorityStr = data.priority === 1 ? "HIGH" : data.priority === 3 ? "LOW" : "NORMAL";

      const actionItem = await prisma.callActionItem.create({
        data: {
          callId,
          orgId: user.orgId,
          description: data.description,
          assigneeUserId: data.assigneeUserId,
          assigneeName: data.assigneeName,
          dueDate: data.dueDate,
          priority: priorityStr,
          source: "MANUAL",
          status: ActionItemStatus.OPEN,
        },
        include: {
          assigneeUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return NextResponse.json(
        { success: true, data: actionItem },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error creating action items:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create action items" } },
      { status: 500 }
    );
  }
}
