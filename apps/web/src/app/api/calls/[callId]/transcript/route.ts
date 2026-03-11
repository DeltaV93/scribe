import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCallById, getCallTranscript } from "@/lib/services/calls";
import { UserRole } from "@/types";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/:callId/transcript - Get call transcript
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    // Verify call exists and user has access
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
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this transcript" } },
        { status: 403 }
      );
    }

    const transcript = await getCallTranscript(callId, user.orgId);

    if (!transcript) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Transcript not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        callId: transcript.id,
        raw: transcript.transcriptRaw,
        segments: transcript.transcriptJson,
        processingStatus: transcript.aiProcessingStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch transcript" } },
      { status: 500 }
    );
  }
}
