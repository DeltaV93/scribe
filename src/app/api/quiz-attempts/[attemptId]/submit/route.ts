import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { completeAttempt, getAttemptById } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";

interface RouteParams {
  params: Promise<{ attemptId: string }>;
}

/**
 * POST /api/quiz-attempts/:attemptId/submit - Complete a quiz attempt
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { attemptId } = await params;

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    // Verify attempt belongs to user
    const attempt = await getAttemptById(attemptId, user.id);
    if (!attempt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Attempt not found" } },
        { status: 404 }
      );
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Attempt is already completed" } },
        { status: 403 }
      );
    }

    const completedAttempt = await completeAttempt(attemptId, user.id);

    return NextResponse.json({
      success: true,
      data: completedAttempt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete attempt";
    console.error("Error completing quiz attempt:", error);

    if (message.includes("not found")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message } },
        { status: 404 }
      );
    }

    if (message.includes("already completed")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message } },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
