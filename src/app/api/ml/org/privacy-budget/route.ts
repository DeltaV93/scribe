import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

/**
 * GET /api/ml/org/privacy-budget - Get the organization's privacy budget status
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const budget = await mlServices.orgProfile.getPrivacyBudget(user.orgId);

    return NextResponse.json({ success: true, data: budget });
  } catch (error) {
    console.error("Error getting privacy budget:", error);

    if (error instanceof MLServiceApiError) {
      // If org profile doesn't exist, return sensible defaults
      if (error.code === "ORG_PROFILE_NOT_FOUND") {
        return NextResponse.json({
          success: true,
          data: {
            org_id: null,
            epsilon_budget: 0,
            epsilon_consumed: 0,
            epsilon_remaining: 0,
            budget_reset_at: null,
            is_exhausted: false,
          },
        });
      }

      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get privacy budget" } },
      { status: 500 }
    );
  }
}
