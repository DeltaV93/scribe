import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  updateLocation,
  deleteLocation,
  getLocationUsers,
  getUserAccessLevel,
} from "@/lib/services/access-control";
import { prisma } from "@/lib/db";
import { LocationAccessLevel } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/locations/[id]
 * Get a specific location with its users
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if user has at least VIEW access to this location or is admin
    const accessLevel = await getUserAccessLevel(user.id, id);
    if (!accessLevel && !isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const location = await prisma.location.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        children: {
          select: { id: true, name: true, type: true, code: true },
          where: { isActive: true },
        },
        _count: {
          select: { meetings: true, userAccess: true },
        },
      },
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // Get users with access (only if admin or has MANAGE access)
    let users = null;
    if (isAdmin(user) || accessLevel === LocationAccessLevel.MANAGE) {
      users = await getLocationUsers(id, user.orgId);
    }

    return NextResponse.json({
      data: {
        ...location,
        users,
      },
    });
  } catch (error) {
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/locations/[id]
 * Update a location
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify location exists and belongs to org
    const existing = await prisma.location.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, parentId, address, timezone, isActive } = body;

    // Validate parentId if provided - prevent circular references
    if (parentId) {
      // Check that parent exists and is in same org
      const parent = await prisma.location.findFirst({
        where: { id: parentId, orgId: user.orgId },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent location not found" },
          { status: 400 }
        );
      }

      // Prevent setting self as parent
      if (parentId === id) {
        return NextResponse.json(
          { error: "Cannot set location as its own parent" },
          { status: 400 }
        );
      }

      // TODO: Add check for circular references in hierarchy
    }

    await updateLocation(id, user.orgId, {
      name,
      code,
      parentId,
      address,
      timezone,
      isActive,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("Error updating location:", error);

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return NextResponse.json(
        { error: "A location with this code already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/locations/[id]
 * Delete a location (soft delete if has meetings, hard delete otherwise)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify location exists and belongs to org
    const existing = await prisma.location.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const result = await deleteLocation(id, user.orgId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}
