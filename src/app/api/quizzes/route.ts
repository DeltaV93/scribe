import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createQuiz, listQuizzes } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { QuizAudience, QuizQuestionType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a quiz
const createQuestionSchema = z.object({
  type: z.nativeEnum(QuizQuestionType),
  question: z.string().min(1, "Question is required").max(2000),
  options: z
    .object({
      choices: z.array(z.string()).optional(),
      leftItems: z.array(z.string()).optional(),
      rightItems: z.array(z.string()).optional(),
      items: z.array(z.string()).optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      minLabel: z.string().optional(),
      maxLabel: z.string().optional(),
      allowedTypes: z.array(z.string()).optional(),
      maxSizeBytes: z.number().optional(),
    })
    .nullable()
    .optional(),
  correctAnswer: z.any().nullable(), // Type varies by question type
  points: z.number().int().min(1).max(100).optional(),
  order: z.number().int().min(0),
});

const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).nullable().optional(),
  audience: z.nativeEnum(QuizAudience).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  questions: z.array(createQuestionSchema).min(1, "At least one question is required"),
});

/**
 * GET /api/quizzes - List quizzes for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const audience = searchParams.get("audience") as QuizAudience | null;
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await listQuizzes(
      user.orgId,
      {
        audience: audience || undefined,
        isActive: isActive !== null ? isActive === "true" : undefined,
        search,
      },
      {
        page,
        limit: Math.min(limit, 100),
      }
    );

    return NextResponse.json({
      success: true,
      data: result.quizzes,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing quizzes:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list quizzes" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quizzes - Create a new quiz
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check feature flag
    const quizzesEnabled = await isFeatureEnabled(user.orgId, "quizzes");
    if (!quizzesEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Quizzes feature is not enabled" } },
        { status: 403 }
      );
    }

    // Only admins and program managers can create quizzes
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create quizzes" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createQuizSchema.safeParse(body);

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

    const data = validation.data;

    const quiz = await createQuiz({
      organizationId: user.orgId,
      createdById: user.id,
      title: data.title,
      description: data.description,
      audience: data.audience,
      passingScore: data.passingScore,
      maxAttempts: data.maxAttempts,
      questions: data.questions.map((q) => ({
        ...q,
        correctAnswer: q.correctAnswer ?? null,
      })),
    });

    return NextResponse.json(
      { success: true, data: quiz },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create quiz" } },
      { status: 500 }
    );
  }
}
