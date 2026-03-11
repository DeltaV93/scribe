import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getKeyResultById,
  updateKeyResultProgress,
  getKeyResultProgressHistory,
  getObjectiveById,
} from "@/lib/services/okrs";
import { z } from "zod";

// Validation schema for updating progress
const updateProgressSchema = z.object({
  value: z.number().min(0, "Value must be non-negative"),
  notes: z.string().max(1000).optional(),
});

interface RouteParams {
  params: Promise<{ krId: string }>;
}

/**
 * GET /api/key-results/[krId]/progress - Get progress history for a key result
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { krId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const cursor = searchParams.get("cursor") || undefined;

    // Verify key result exists
    const keyResult = await getKeyResultById(krId);
    if (!keyResult) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Key result not found" } },
        { status: 404 }
      );
    }

    // Verify objective belongs to org
    const objective = await getObjectiveById(keyResult.objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Key result not found" } },
        { status: 404 }
      );
    }

    const result = await getKeyResultProgressHistory(krId, {
      limit: Math.min(limit, 100),
      cursor,
    });

    return NextResponse.json({
      success: true,
      data: result.history,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching progress history:", error);
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress history" },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/key-results/[krId]/progress - Update key result progress
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { krId } = await params;

    // Verify key result exists
    const keyResult = await getKeyResultById(krId);
    if (!keyResult) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Key result not found" } },
        { status: 404 }
      );
    }

    // Verify objective belongs to org
    const objective = await getObjectiveById(keyResult.objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Key result not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateProgressSchema.safeParse(body);

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

    const updatedKeyResult = await updateKeyResultProgress(
      krId,
      validation.data.value,
      user.id,
      validation.data.notes
    );

    return NextResponse.json({ success: true, data: updatedKeyResult });
  } catch (error) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update progress" } },
      { status: 500 }
    );
  }
}
