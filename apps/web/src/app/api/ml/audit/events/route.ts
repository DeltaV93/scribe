import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError, RiskTier } from "@/lib/ml-services";

/**
 * GET /api/ml/audit/events - List audit events for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("event_type") || undefined;
    const riskTier = searchParams.get("risk_tier") as RiskTier | null;
    const startDate = searchParams.get("start_date") || undefined;
    const endDate = searchParams.get("end_date") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "50", 10);

    const result = await mlServices.audit.listEvents({
      orgId: user.orgId,
      eventType,
      riskTier: riskTier || undefined,
      startDate,
      endDate,
      page,
      pageSize: Math.min(pageSize, 250),
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.page_size,
        total: result.total,
        totalPages: Math.ceil(result.total / result.page_size),
      },
    });
  } catch (error) {
    console.error("Error listing audit events:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list audit events" } },
      { status: 500 }
    );
  }
}
