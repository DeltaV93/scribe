import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAttemptById } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { UserRole } from "@/types";

interface RouteParams {
  params: Promise<{ attemptId: string }>;
}

/**
 * GET /api/quiz-attempts/:attemptId - Get attempt details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Admins can view any attempt, users can only view their own
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROGRAM_MANAGER].includes(
      user.role
    );

    const attempt = await getAttemptById(attemptId, isAdmin ? undefined : user.id);

    if (!attempt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Attempt not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    console.error("Error getting quiz attempt:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get quiz attempt" } },
      { status: 500 }
    );
  }
}
