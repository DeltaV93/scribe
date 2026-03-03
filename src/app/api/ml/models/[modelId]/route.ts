import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ modelId: string }>;
}

// Validation schema for updating a model
const updateModelSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * GET /api/ml/models/[modelId] - Get a specific model
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId } = await params;

    const model = await mlServices.models.get(modelId);

    return NextResponse.json({ success: true, data: model });
  } catch (error) {
    console.error("Error getting model:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get model" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ml/models/[modelId] - Update a model
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId } = await params;

    const body = await request.json();
    const validation = updateModelSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid model data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const model = await mlServices.models.update(modelId, validation.data);

    return NextResponse.json({ success: true, data: model });
  } catch (error) {
    console.error("Error updating model:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update model" } },
      { status: 500 }
    );
  }
}
