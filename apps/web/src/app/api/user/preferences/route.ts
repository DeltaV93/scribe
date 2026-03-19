import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/user/preferences - Get current user preferences
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        showQuickActionFab: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: {
        showQuickActionFab: userData.showQuickActionFab,
      },
    });
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch preferences" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/preferences - Update user preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate and extract allowed preference fields
    const allowedFields = ["showQuickActionFab"];
    const updates: Record<string, boolean> = {};

    for (const field of allowedFields) {
      if (typeof body[field] === "boolean") {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "No valid preference fields provided" } },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: {
        showQuickActionFab: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: {
        showQuickActionFab: updatedUser.showQuickActionFab,
      },
    });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update preferences" } },
      { status: 500 }
    );
  }
}
