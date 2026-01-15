import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { initiateCall, listCalls, getCaseManagerCalls } from "@/lib/services/calls";
import { UserRole } from "@/types";
import { CallStatus } from "@prisma/client";

/**
 * GET /api/calls - List calls
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as CallStatus | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (clientId) filters.clientId = clientId;

    // Case managers only see their own calls
    let result;
    if (user.role === UserRole.CASE_MANAGER) {
      result = await getCaseManagerCalls(
        user.id,
        user.orgId,
        filters,
        { page, limit }
      );
    } else {
      result = await listCalls(user.orgId, filters, { page, limit });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error listing calls:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list calls" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls - Initiate a new call
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { clientId, formIds } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Client ID is required" } },
        { status: 400 }
      );
    }

    const call = await initiateCall({
      clientId,
      caseManagerId: user.id,
      formIds: formIds || [],
      orgId: user.orgId,
    });

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error("Error initiating call:", error);

    if (error instanceof Error && error.message === "Client not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to initiate call" } },
      { status: 500 }
    );
  }
}
