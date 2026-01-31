import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  removeLocationAccess,
  assignLocationAccess,
  getUserAccessLevel,
} from "@/lib/services/access-control";
import { prisma } from "@/lib/db";
import { LocationAccessLevel } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * GET /api/admin/locations/[id]/users/[userId]
 * Get specific user's access level for this location
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: locationId, userId: targetUserId } = await params;

    // Check if user has MANAGE access to this location or is admin
    const accessLevel = await getUserAccessLevel(user.id, locationId);
    if (!isAdmin(user) && accessLevel !== LocationAccessLevel.MANAGE) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify location exists and belongs to org
    const location = await prisma.location.findFirst({
      where: { id: locationId, orgId: user.orgId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Get target user's access level
    const targetAccessLevel = await getUserAccessLevel(targetUserId, locationId);

    // Get direct assignment if any
    const directAssignment = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: { userId: targetUserId, locationId },
      },
      include: {
        grantedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      data: {
        userId: targetUserId,
        locationId,
        accessLevel: targetAccessLevel,
        isDirectAssignment: !!directAssignment,
        assignment: directAssignment
          ? {
              accessLevel: directAssignment.accessLevel,
              grantedAt: directAssignment.grantedAt,
              grantedBy: directAssignment.grantedBy,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching user location access:", error);
    return NextResponse.json(
      { error: "Failed to fetch user location access" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/locations/[id]/users/[userId]
 * Update a user's access level for this location
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: locationId, userId: targetUserId } = await params;

    // Verify location exists and belongs to org
    const location = await prisma.location.findFirst({
      where: { id: locationId, orgId: user.orgId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const body = await request.json();
    const { accessLevel } = body;

    // Validate access level
    if (!accessLevel || !Object.values(LocationAccessLevel).includes(accessLevel)) {
      return NextResponse.json(
        { error: "Valid accessLevel is required" },
        { status: 400 }
      );
    }

    // Verify target user exists and is in same org
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, orgId: user.orgId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update access (this checks if granter has MANAGE permission)
    const result = await assignLocationAccess({
      userId: targetUserId,
      locationId,
      accessLevel,
      grantedById: user.id,
      orgId: user.orgId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("Error updating location access:", error);
    return NextResponse.json(
      { error: "Failed to update location access" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/locations/[id]/users/[userId]
 * Remove a user's access to this location
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: locationId, userId: targetUserId } = await params;

    // Verify location exists and belongs to org
    const location = await prisma.location.findFirst({
      where: { id: locationId, orgId: user.orgId },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, orgId: user.orgId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove access (this checks if remover has MANAGE permission)
    const result = await removeLocationAccess({
      userId: targetUserId,
      locationId,
      removedById: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("Error removing location access:", error);
    return NextResponse.json(
      { error: "Failed to remove location access" },
      { status: 500 }
    );
  }
}
