import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { startAttempt, getQuizById, getAllAttempts } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { UserRole } from "@/types";
import { headers } from "next/headers";

// Rate limiting: 10 quiz attempts per hour per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

/**
 * GET /api/quizzes/:id/attempts - Get all attempts for a quiz (admin view)
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

    // Only admins and program managers can view all attempts
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view all attempts" } },
        { status: 403 }
      );
    }

    // Verify quiz exists and belongs to org
    const quiz = await getQuizById(quizId, user.orgId);
    if (!quiz) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quiz not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await getAllAttempts(quizId, { page, limit: Math.min(limit, 100) });

    return NextResponse.json({
      success: true,
      data: result.attempts,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting quiz attempts:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get quiz attempts" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quizzes/:id/attempts - Start a new quiz attempt
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many quiz attempts. Please try again later.",
          },
        },
        { status: 429 }
      );
    }

    // Verify quiz exists and belongs to org
    const quiz = await getQuizById(quizId, user.orgId);
    if (!quiz) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quiz not found" } },
        { status: 404 }
      );
    }

    // Check audience
    const isStaff = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.PROGRAM_MANAGER,
      UserRole.CASE_MANAGER,
    ].includes(user.role);

    if (quiz.audience === "STAFF" && !isStaff) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This quiz is only available to staff" } },
        { status: 403 }
      );
    }

    if (quiz.audience === "CLIENT" && isStaff) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "This quiz is only available to clients" } },
        { status: 403 }
      );
    }

    const attempt = await startAttempt(quizId, user.id, user.orgId);

    return NextResponse.json(
      { success: true, data: attempt },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start quiz attempt";
    console.error("Error starting quiz attempt:", error);

    // Handle known errors
    if (message.includes("already passed") || message.includes("Maximum attempts")) {
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
