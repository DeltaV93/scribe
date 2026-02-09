import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getQuizById, updateQuiz, archiveQuiz, getQuizStats } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { QuizAudience } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  audience: z.nativeEnum(QuizAudience).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * GET /api/quizzes/:id - Get quiz details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { quizId } = await params;

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    const quiz = await getQuizById(quizId, user.orgId);

    if (!quiz) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quiz not found" } },
        { status: 404 }
      );
    }

    // Include stats if requested
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    let stats = null;
    if (includeStats) {
      stats = await getQuizStats(quizId);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...quiz,
        ...(stats && { stats }),
      },
    });
  } catch (error) {
    console.error("Error getting quiz:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get quiz" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/quizzes/:id - Update quiz
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { quizId } = await params;

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    // Only admins and program managers can update quizzes
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update quizzes" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateQuizSchema.safeParse(body);

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

    // Check quiz exists
    const existingQuiz = await getQuizById(quizId, user.orgId);
    if (!existingQuiz) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quiz not found" } },
        { status: 404 }
      );
    }

    const quiz = await updateQuiz(quizId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Error updating quiz:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update quiz" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quizzes/:id - Archive quiz (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { quizId } = await params;

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    // Only admins can archive quizzes
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete quizzes" } },
        { status: 403 }
      );
    }

    // Check quiz exists
    const existingQuiz = await getQuizById(quizId, user.orgId);
    if (!existingQuiz) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quiz not found" } },
        { status: 404 }
      );
    }

    await archiveQuiz(quizId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Quiz archived successfully",
    });
  } catch (error) {
    console.error("Error archiving quiz:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive quiz" } },
      { status: 500 }
    );
  }
}
