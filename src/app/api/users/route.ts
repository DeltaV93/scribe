/**
 * Users API - Basic user list for org members
 *
 * GET /api/users - Get active users in the organization
 *
 * This endpoint is available to all authenticated org members (not just admins)
 * and returns minimal user data for use in user pickers/assignment UIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;

    // Build where clause
    const where: Record<string, unknown> = {
      orgId: user.orgId,
      isActive: true,
    };

    // Add search filter (case-insensitive on name or email)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch users" } },
      { status: 500 }
    );
  }
}
