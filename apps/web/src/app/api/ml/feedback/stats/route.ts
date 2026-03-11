import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError, AggregationPeriod } from "@/lib/ml-services";

/**
 * GET /api/ml/feedback/stats - Get feedback statistics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("model_id");
    const versionId = searchParams.get("version_id") || undefined;
    const period = searchParams.get("period") as AggregationPeriod | null;
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    if (!modelId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "model_id is required",
          },
        },
        { status: 400 }
      );
    }

    const stats = await mlServices.feedback.getStats({
      modelId,
      versionId,
      period: period || undefined,
      limit: Math.min(limit, 365),
      orgId: user.orgId,
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting feedback stats:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get feedback stats" } },
      { status: 500 }
    );
  }
}
