/**
 * Current User API
 *
 * GET /api/users/me - Get the currently authenticated user
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: user.orgId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get current user" } },
      { status: 500 }
    );
  }
}
