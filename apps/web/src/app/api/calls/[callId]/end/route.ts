import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCallById, endCall } from "@/lib/services/calls";
import { UserRole } from "@/types";
import { CallStatus } from "@prisma/client";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/end - End a call
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    // Verify call exists and user has access
    const existingCall = await getCallById(callId, user.orgId);

    if (!existingCall) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Case managers can only end their own calls
    if (user.role === UserRole.CASE_MANAGER && existingCall.caseManagerId !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to end this call" } },
        { status: 403 }
      );
    }

    // Verify call is in a state that can be ended
    const activeStatuses: CallStatus[] = [
      CallStatus.INITIATING,
      CallStatus.RINGING,
      CallStatus.IN_PROGRESS,
    ];

    if (!activeStatuses.includes(existingCall.status)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Cannot end call with status ${existingCall.status}`
          }
        },
        { status: 400 }
      );
    }

    const call = await endCall(callId);

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error) {
    console.error("Error ending call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to end call" } },
      { status: 500 }
    );
  }
}
