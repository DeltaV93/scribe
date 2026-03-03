import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

interface RouteContext {
  params: Promise<{ feedbackId: string }>;
}

/**
 * GET /api/ml/feedback/[feedbackId] - Get feedback by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { feedbackId } = await context.params;

    const feedback = await mlServices.feedback.get(feedbackId, user.orgId);

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error("Error getting feedback:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get feedback" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ml/feedback/[feedbackId] - Delete feedback
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { feedbackId } = await context.params;

    await mlServices.feedback.delete(feedbackId, user.orgId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting feedback:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete feedback" } },
      { status: 500 }
    );
  }
}
