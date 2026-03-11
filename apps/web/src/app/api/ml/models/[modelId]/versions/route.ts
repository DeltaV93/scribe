import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ modelId: string }>;
}

// Validation schema for creating a version
const createVersionSchema = z.object({
  config: z.record(z.unknown()).optional(),
  artifact_s3_path: z.string().optional(),
  parent_version_id: z.string().uuid().optional(),
});

/**
 * GET /api/ml/models/[modelId]/versions - List versions for a model
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId } = await params;

    const result = await mlServices.versions.list(modelId);

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
    });
  } catch (error) {
    console.error("Error listing versions:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list versions" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ml/models/[modelId]/versions - Create a new version
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId } = await params;

    const body = await request.json();
    const validation = createVersionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid version data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const version = await mlServices.versions.create(modelId, validation.data);

    return NextResponse.json(
      { success: true, data: version },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating version:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create version" } },
      { status: 500 }
    );
  }
}
