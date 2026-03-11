import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { submitAnswer, getAttemptById } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { z } from "zod";

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.any(), // Type varies by question type
  fileUrl: z.string().url().optional(),
});

interface RouteParams {
  params: Promise<{ attemptId: string }>;
}

/**
 * POST /api/quiz-attempts/:attemptId/answers - Submit an answer
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
        { error: { code: "FORBIDDEN", message: "Cannot submit answer to a completed attempt" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = submitAnswerSchema.safeParse(body);

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

    const { questionId, answer, fileUrl } = validation.data;

    const quizAnswer = await submitAnswer(attemptId, questionId, answer, fileUrl);

    return NextResponse.json({
      success: true,
      data: quizAnswer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit answer";
    console.error("Error submitting answer:", error);

    if (
      message.includes("not found") ||
      message.includes("does not belong")
    ) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
