import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ modelId: string; versionNumber: string }>;
}

// Validation schema for updating a version
const updateVersionSchema = z.object({
  status: z.enum(["training", "validating", "ready", "deployed", "deprecated"]).optional(),
  artifact_s3_path: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  metrics: z.record(z.unknown()).optional(),
});

/**
 * GET /api/ml/models/[modelId]/versions/[versionNumber] - Get a specific version
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId, versionNumber } = await params;

    const versionNum = parseInt(versionNumber, 10);
    if (isNaN(versionNum)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid version number" } },
        { status: 400 }
      );
    }

    const version = await mlServices.versions.get(modelId, versionNum);

    return NextResponse.json({ success: true, data: version });
  } catch (error) {
    console.error("Error getting version:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get version" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ml/models/[modelId]/versions/[versionNumber] - Update a version
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { modelId, versionNumber } = await params;

    const versionNum = parseInt(versionNumber, 10);
    if (isNaN(versionNum)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid version number" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateVersionSchema.safeParse(body);

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

    const version = await mlServices.versions.update(modelId, versionNum, validation.data);

    return NextResponse.json({ success: true, data: version });
  } catch (error) {
    console.error("Error updating version:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update version" } },
      { status: 500 }
    );
  }
}
