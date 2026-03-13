import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation, logAccess } from "@/lib/services/conversation-access";
import { queueForProcessing } from "@/lib/services/conversation-processing";
import { createAuditLog } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id - Get conversation details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        phoneCallDetails: true,
        inPersonDetails: true,
        videoMeetingDetails: true,
        clientLinks: {
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        flaggedSegments: {
          where: { status: "PENDING" },
          orderBy: { startTime: "asc" },
        },
        draftedOutputs: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            flaggedSegments: true,
            draftedOutputs: true,
            accessList: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Log access for restricted content
    await logAccess(id, user.id, "VIEW");

    // Check if current user can edit the title (creator only)
    const canEditTitle = conversation.createdById === user.id;

    return NextResponse.json({
      success: true,
      conversation,
      accessType: accessResult.accessType,
      canEditTitle,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch conversation" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id - Update conversation
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const { title, status, recordingUrl, endedAt, durationSeconds } = body;

    // Store old title for audit logging if title is being updated
    let oldTitle: string | null = null;

    // Title validation and creator-only check
    if (title !== undefined) {
      // Validate title length
      if (title !== null && title.length > 100) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Title must be 100 characters or less" } },
          { status: 400 }
        );
      }

      // Only creator can edit title
      const existingConversation = await prisma.conversation.findUnique({
        where: { id },
        select: { createdById: true, title: true },
      });

      if (!existingConversation) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Conversation not found" } },
          { status: 404 }
        );
      }

      if (existingConversation.createdById !== user.id) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Only the creator can edit the title" } },
          { status: 403 }
        );
      }

      oldTitle = existingConversation.title;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (status !== undefined) updateData.status = status;
    if (recordingUrl !== undefined) updateData.recordingUrl = recordingUrl;
    if (endedAt !== undefined) updateData.endedAt = new Date(endedAt);
    if (durationSeconds !== undefined) updateData.durationSeconds = durationSeconds;

    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        recordingUrl: true,
      },
    });

    // If recording finished, queue for processing
    if (status === "PROCESSING" || (recordingUrl && !body.skipProcessing)) {
      await queueForProcessing(id);
    }

    // Audit log with enhanced details for title changes
    const auditDetails: Record<string, unknown> = { updatedFields: Object.keys(updateData) };
    if (title !== undefined) {
      auditDetails.titleChange = { oldValue: oldTitle, newValue: title };
    }

    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "CONVERSATION",
      resourceId: id,
      details: auditDetails,
    });

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update conversation" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id - Delete conversation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify conversation exists and user owns it or is admin
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        createdById: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not authorized" } },
        { status: 403 }
      );
    }

    // Only creator or admin can delete
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (conversation.createdById !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the creator or admin can delete" } },
        { status: 403 }
      );
    }

    // Delete conversation (cascades to related records)
    await prisma.conversation.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "DELETE",
      resource: "CONVERSATION",
      resourceId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Conversation deleted",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete conversation" } },
      { status: 500 }
    );
  }
}
