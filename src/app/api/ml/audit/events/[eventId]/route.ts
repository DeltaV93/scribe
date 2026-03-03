import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import mlServices, { MLServiceApiError } from "@/lib/ml-services";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/ml/audit/events/[eventId] - Get a specific audit event
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { eventId } = await params;

    const event = await mlServices.audit.getEvent(eventId);

    // Verify the event belongs to the user's organization
    if (event.org_id !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error("Error getting audit event:", error);

    if (error instanceof MLServiceApiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get audit event" } },
      { status: 500 }
    );
  }
}
