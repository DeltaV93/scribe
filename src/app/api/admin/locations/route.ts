import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getLocationHierarchy,
  createLocation,
} from "@/lib/services/access-control";
import { LocationType } from "@prisma/client";

/**
 * GET /api/admin/locations
 * List all locations in the organization's hierarchy
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const locations = await getLocationHierarchy(user.orgId);

    return NextResponse.json({ data: locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/locations
 * Create a new location
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, code, parentId, address, timezone } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    // Validate location type
    if (!Object.values(LocationType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid location type" },
        { status: 400 }
      );
    }

    const result = await createLocation({
      orgId: user.orgId,
      name,
      type,
      code,
      parentId,
      address,
      timezone,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating location:", error);

    // Handle unique constraint violation
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
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}
