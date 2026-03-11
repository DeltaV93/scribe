/**
 * ML Services Compliance Status API
 *
 * Returns compliance status for the organization.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAdmin } from "@/lib/auth";
import mlServices, { MLServiceApiError, ComplianceStatus } from "@/lib/ml-services";

export async function GET() {
  try {
    const user = await requireAuth();

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    let status: ComplianceStatus;

    try {
      status = await mlServices.orgProfile.getComplianceStatus(user.orgId);
    } catch (error) {
      // Return default values if org profile not found
      if (error instanceof MLServiceApiError && error.statusCode === 404) {
        status = {
          org_id: user.orgId,
          frameworks: [],
          overrides_count: 0,
          last_audit_at: null,
        };
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("ML compliance error:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch compliance status" } },
      { status: 500 }
    );
  }
}
