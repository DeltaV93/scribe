import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

/**
 * GET /api/ml/org/compliance - Get the organization's compliance status
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const compliance = await mlServices.orgProfile.getComplianceStatus(user.orgId);

    return NextResponse.json({ success: true, data: compliance });
  } catch (error) {
    console.error("Error getting compliance status:", error);

    if (error instanceof MLServiceApiError) {
      // If org profile doesn't exist, return empty compliance
      if (error.code === "ORG_PROFILE_NOT_FOUND") {
        return NextResponse.json({
          success: true,
          data: {
            org_id: null,
            frameworks: [],
            overrides_count: 0,
            last_audit_at: null,
          },
        });
      }

      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get compliance status" } },
      { status: 500 }
    );
  }
}
