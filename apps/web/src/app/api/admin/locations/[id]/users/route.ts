import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  assignLocationAccess,
  getLocationUsers,
  getUserAccessLevel,
} from "@/lib/services/access-control";
import { prisma } from "@/lib/db";
import { LocationAccessLevel } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/locations/[id]/users
 * List all users with access to this location
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user has MANAGE access to this location or is admin
    const accessLevel = await getUserAccessLevel(user.id, id);
    if (!isAdmin(user) && accessLevel !== LocationAccessLevel.MANAGE) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify location exists and belongs to org
    const location = await prisma.location.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const users = await getLocationUsers(id, user.orgId);

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("Error fetching location users:", error);
    return NextResponse.json(
      { error: "Failed to fetch location users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/locations/[id]/users
 * Assign user access to this location
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: locationId } = await params;

    // Verify location exists and belongs to org
    const location = await prisma.location.findFirst({
      where: { id: locationId, orgId: user.orgId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const body = await request.json();
    const { userId, accessLevel } = body;

    // Validate required fields
    if (!userId || !accessLevel) {
      return NextResponse.json(
        { error: "userId and accessLevel are required" },
        { status: 400 }
      );
    }

    // Validate access level
    if (!Object.values(LocationAccessLevel).includes(accessLevel)) {
      return NextResponse.json(
        { error: "Invalid access level" },
        { status: 400 }
      );
    }

    // Verify target user exists and is in same org
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, orgId: user.orgId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Assign access (this checks if granter has MANAGE permission)
    const result = await assignLocationAccess({
      userId,
      locationId,
      accessLevel,
      grantedById: user.id,
      orgId: user.orgId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch (error) {
    console.error("Error assigning location access:", error);
    return NextResponse.json(
      { error: "Failed to assign location access" },
      { status: 500 }
    );
  }
}
