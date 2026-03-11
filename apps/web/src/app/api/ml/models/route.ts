import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError, ModelType } from "@/lib/ml-services";
import { z } from "zod";

// Validation schema for creating a model
const createModelSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  model_type: z.enum(["llm", "extraction", "classification"]),
  description: z.string().max(1000).optional(),
  is_global: z.boolean().optional(),
});

/**
 * GET /api/ml/models - List models for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const modelType = searchParams.get("model_type") as ModelType | null;
    const includeGlobal = searchParams.get("include_global") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "50", 10);

    const result = await mlServices.models.list({
      modelType: modelType || undefined,
      includeGlobal,
      page,
      pageSize: Math.min(pageSize, 250),
      orgId: user.orgId,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.page_size,
        total: result.total,
        totalPages: Math.ceil(result.total / result.page_size),
      },
    });
  } catch (error) {
    console.error("Error listing models:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list models" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ml/models - Create a new model
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createModelSchema.safeParse(body);

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

    const model = await mlServices.models.create({
      ...validation.data,
      org_id: user.orgId,
    });

    return NextResponse.json(
      { success: true, data: model },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating model:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create model" } },
      { status: 500 }
    );
  }
}
