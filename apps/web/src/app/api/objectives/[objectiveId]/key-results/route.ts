import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getObjectiveById,
  createKeyResult,
  listKeyResults,
} from "@/lib/services/okrs";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a key result
const createKeyResultSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).nullable().optional(),
  targetValue: z.number().positive("Target value must be positive"),
  startValue: z.number().default(0),
  unit: z.string().max(50).nullable().optional(),
  weight: z.number().min(0.1).max(10).default(1.0),
});

interface RouteParams {
  params: Promise<{ objectiveId: string }>;
}

/**
 * GET /api/objectives/[objectiveId]/key-results - List key results for an objective
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const keyResults = await listKeyResults(objectiveId);

    return NextResponse.json({
      success: true,
      data: keyResults,
    });
  } catch (error) {
    console.error("Error listing key results:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list key results" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/objectives/[objectiveId]/key-results - Create a new key result
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { objectiveId } = await params;

    // Only admins and program managers can create key results
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to create key results",
          },
        },
        { status: 403 }
      );
    }

    // Verify objective exists and belongs to org
    const objective = await getObjectiveById(objectiveId, user.orgId);
    if (!objective) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Objective not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createKeyResultSchema.safeParse(body);

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

    const data = validation.data;

    // Validate start value is less than target value
    if (data.startValue >= data.targetValue) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Start value must be less than target value",
          },
        },
        { status: 400 }
      );
    }

    const keyResult = await createKeyResult({
      objectiveId,
      title: data.title,
      description: data.description,
      targetValue: data.targetValue,
      startValue: data.startValue,
      unit: data.unit,
      weight: data.weight,
    });

    return NextResponse.json({ success: true, data: keyResult }, { status: 201 });
  } catch (error) {
    console.error("Error creating key result:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create key result" } },
      { status: 500 }
    );
  }
}
