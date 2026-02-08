import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getObjectiveById,
  addObjectiveUpdate,
  listObjectiveUpdates,
} from "@/lib/services/okrs";
import { z } from "zod";

// Validation schema for creating an update (check-in)
const createUpdateSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
});

interface RouteParams {
  params: Promise<{ objectiveId: string }>;
}

/**
 * GET /api/objectives/[objectiveId]/updates - List updates for an objective
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const cursor = searchParams.get("cursor") || undefined;

    // Verify objective exists and belongs to org
    const objective = await getObjectiveById(objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    const result = await listObjectiveUpdates(objectiveId, {
      limit: Math.min(limit, 50),
      cursor,
    });

    return NextResponse.json({
      success: true,
      data: result.updates,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing objective updates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list updates" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/objectives/[objectiveId]/updates - Add a check-in update
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    // Verify objective exists and belongs to org
    const objective = await getObjectiveById(objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const update = await addObjectiveUpdate(
      objectiveId,
      validation.data.content,
      user.id
    );

    return NextResponse.json({ success: true, data: update }, { status: 201 });
  } catch (error) {
    console.error("Error creating objective update:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create update" } },
      { status: 500 }
    );
  }
}
