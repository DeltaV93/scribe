/**
 * ML Services Privacy Budget API
 *
 * Returns privacy budget status for the organization.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAdmin } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

export async function GET() {
  try {
    const user = await requireAuth();

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const budget = await mlServices.orgProfile.getPrivacyBudget(user.orgId);

    return NextResponse.json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error("ML privacy budget error:", error);

    // Return default values if org profile not found
    if (error instanceof MLServiceApiError && error.statusCode === 404) {
      return NextResponse.json({
        success: true,
        data: {
          org_id: "",
          epsilon_budget: 5.0,
          epsilon_consumed: 0.0,
          epsilon_remaining: 5.0,
          budget_reset_at: null,
          is_exhausted: false,
        },
      });
    }

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch privacy budget" } },
      { status: 500 }
    );
  }
}
