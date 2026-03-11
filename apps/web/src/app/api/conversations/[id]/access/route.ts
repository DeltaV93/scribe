import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canAccessConversation,
  grantAccess,
  revokeAccess,
  getAccessList,
  getGrantableUsers,
} from "@/lib/services/conversation-access";
import type { ConversationAccessType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/access - Get access list
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

    // Get conversation to find creator
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        createdById: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        orgId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    const accessList = await getAccessList(id);
    const grantableUsers = await getGrantableUsers(id, conversation.orgId);

    return NextResponse.json({
      success: true,
      creator: conversation.createdBy,
      accessList,
      grantableUsers,
    });
  } catch (error) {
    console.error("Error fetching access list:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch access list" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/:id/access - Grant access
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { userId, accessType = "GRANTED" } = body as {
      userId: string;
      accessType?: ConversationAccessType;
    };

    if (!userId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "User ID is required" } },
        { status: 400 }
      );
    }

    // Grant access (will check permissions internally)
    const access = await grantAccess(id, userId, user.id, accessType);

    return NextResponse.json({
      success: true,
      access,
    });
  } catch (error) {
    console.error("Error granting access:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Failed to grant access" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id/access - Revoke access
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "User ID is required" } },
        { status: 400 }
      );
    }

    await revokeAccess(id, userId, user.id);

    return NextResponse.json({
      success: true,
      message: "Access revoked",
    });
  } catch (error) {
    console.error("Error revoking access:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Failed to revoke access" } },
      { status: 500 }
    );
  }
}
