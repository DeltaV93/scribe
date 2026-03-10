import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ id: string; outputId: string }>;
}

/**
 * GET /api/conversations/:id/outputs/:outputId - Get single output
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, outputId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
      include: {
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      output,
    });
  } catch (error) {
    console.error("Error fetching output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch output" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/conversations/:id/outputs/:outputId - Edit output draft
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, outputId } = await params;
    const body = await request.json();

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    const { title, content, metadata, destinationPlatform, destinationConfig } = body;

    const updated = await prisma.draftedOutput.update({
      where: { id: outputId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { editedContent: content }),
        ...(metadata !== undefined && { metadata }),
        ...(destinationPlatform !== undefined && { destinationPlatform }),
        ...(destinationConfig !== undefined && { destinationConfig }),
      },
    });

    return NextResponse.json({
      success: true,
      output: updated,
    });
  } catch (error) {
    console.error("Error updating output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update output" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id/outputs/:outputId - Delete output
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id, outputId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, id);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    const output = await prisma.draftedOutput.findUnique({
      where: { id: outputId },
      include: {
        conversation: {
          select: { orgId: true },
        },
      },
    });

    if (!output || output.conversationId !== id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Output not found" } },
        { status: 404 }
      );
    }

    await prisma.draftedOutput.delete({
      where: { id: outputId },
    });

    await createAuditLog({
      orgId: output.conversation.orgId,
      userId: user.id,
      action: "DELETE",
      resource: "DRAFTED_OUTPUT",
      resourceId: outputId,
      details: {
        conversationId: id,
        outputType: output.outputType,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Output deleted",
    });
  } catch (error) {
    console.error("Error deleting output:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete output" } },
      { status: 500 }
    );
  }
}
