import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCallById, updateCall } from "@/lib/services/calls";
import { UserRole } from "@/types";
import { CallStatus } from "@prisma/client";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/:callId - Get a call by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    const call = await getCallById(callId, user.orgId);

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view their own calls
    if (user.role === UserRole.CASE_MANAGER && call.caseManagerId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this call" } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error("Error fetching call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch call" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calls/:callId - Update a call
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;
    const body = await request.json();

    // Verify call exists and user has access
    const existingCall = await getCallById(callId, user.orgId);

    if (!existingCall) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Case managers can only update their own calls
    if (user.role === UserRole.CASE_MANAGER && existingCall.caseManagerId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update this call" } },
        { status: 403 }
      );
    }

    // Only allow updating certain fields
    const allowedUpdates: Record<string, unknown> = {};

    if (body.status && Object.values(CallStatus).includes(body.status)) {
      allowedUpdates.status = body.status;
    }

    if (body.twilioCallSid) {
      allowedUpdates.twilioCallSid = body.twilioCallSid;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No valid fields to update" } },
        { status: 400 }
      );
    }

    const call = await updateCall(callId, allowedUpdates);

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error("Error updating call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update call" } },
      { status: 500 }
    );
  }
}
