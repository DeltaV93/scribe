import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMessage, deleteMessage } from "@/lib/services/messaging";
import { UserRole } from "@/types";

interface RouteContext {
  params: Promise<{ messageId: string }>;
}

/**
 * GET /api/messages/:messageId - Get a single message by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { messageId } = await context.params;

    const message = await getMessage(messageId, user.orgId);

    if (!message) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Message not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error("Error fetching message:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch message" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/:messageId - Soft delete a message
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { messageId } = await context.params;

    // Only admins can delete messages
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only administrators can delete messages" } },
        { status: 403 }
      );
    }

    // Verify message exists
    const message = await getMessage(messageId, user.orgId);

    if (!message) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Message not found" } },
        { status: 404 }
      );
    }

    await deleteMessage(messageId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete message" } },
      { status: 500 }
    );
  }
}
