import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listAvailableQuizzes, getAttemptHistory } from "@/lib/services/quizzes";
import { isFeatureEnabled } from "@/lib/features/flags";
import { UserRole } from "@/types";

/**
 * GET /api/my-quizzes - List available quizzes for the current user
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Determine if user is staff
    const isStaff = [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.PROGRAM_MANAGER,
      UserRole.CASE_MANAGER,
    ].includes(user.role);

    const result = await listAvailableQuizzes(
      user.orgId,
      user.id,
      isStaff,
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
      },
    });
  } catch (error) {
    console.error("Error listing available quizzes:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list quizzes" } },
      { status: 500 }
    );
  }
}
