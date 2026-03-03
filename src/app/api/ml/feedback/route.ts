import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError, FeedbackType } from "@/lib/ml-services";
import { z } from "zod";

// Validation schema for creating feedback
const createFeedbackSchema = z.object({
  model_id: z.string().uuid("Invalid model ID"),
  version_id: z.string().uuid("Invalid version ID").optional(),
  feedback_type: z.enum(["thumbs_up", "thumbs_down", "correction", "comment"]),
  rating: z.number().min(1).max(5).optional(),
  input_data: z.record(z.unknown()).optional(),
  output_data: z.record(z.unknown()).optional(),
  corrected_output: z.record(z.unknown()).optional(),
  comment: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/ml/feedback - List feedback with filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("model_id") || undefined;
    const versionId = searchParams.get("version_id") || undefined;
    const feedbackType = searchParams.get("feedback_type") as FeedbackType | null;
    const startDate = searchParams.get("start_date") || undefined;
    const endDate = searchParams.get("end_date") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "50", 10);

    const result = await mlServices.feedback.list({
      orgId: user.orgId,
      modelId,
      versionId,
      feedbackType: feedbackType || undefined,
      startDate,
      endDate,
      page,
      pageSize: Math.min(pageSize, 250),
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
    console.error("Error listing feedback:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list feedback" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ml/feedback - Submit feedback on a model output
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid feedback data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const feedback = await mlServices.feedback.submit(validation.data, user.orgId, user.id);

    return NextResponse.json(
      { success: true, data: feedback },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error submitting feedback:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to submit feedback" } },
      { status: 500 }
    );
  }
}
