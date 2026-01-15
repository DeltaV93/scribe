import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCallById } from "@/lib/services/calls";
import {
  processCompletedCall,
  reExtractCallFields,
  regenerateCallSummary,
} from "@/lib/services/call-processing";
import { UserRole } from "@/types";
import { CallStatus } from "@prisma/client";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/process - Trigger AI processing for a call
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;
    const body = await request.json().catch(() => ({}));

    // Verify call exists and user has access
    const call = await getCallById(callId, user.orgId);

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Only admins and supervisors can trigger processing
    if (
      user.role === UserRole.CASE_MANAGER &&
      call.caseManagerId !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to process this call" } },
        { status: 403 }
      );
    }

    // Verify call is completed
    if (call.status !== CallStatus.COMPLETED) {
      return NextResponse.json(
        { error: { code: "INVALID_STATE", message: "Can only process completed calls" } },
        { status: 400 }
      );
    }

    // Determine processing mode
    const mode = body.mode || "full";
    let result;

    switch (mode) {
      case "extract":
        // Re-extract fields only (requires existing transcript)
        result = await reExtractCallFields(callId, body.formIds);
        break;

      case "summary":
        // Regenerate summary only (requires existing transcript)
        result = await regenerateCallSummary(callId);
        break;

      case "full":
      default:
        // Full processing (transcription + extraction + summary)
        result = await processCompletedCall(callId);
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "PROCESSING_ERROR", message: result.error || "Processing failed" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        callId: result.callId,
        hasTranscript: !!result.transcript,
        extractedFieldCount: result.extractedFields
          ? Object.keys(result.extractedFields).length
          : 0,
        hasSummary: !!result.summary,
      },
    });
  } catch (error) {
    console.error("Error processing call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process call" } },
      { status: 500 }
    );
  }
}
