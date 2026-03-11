import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCallById } from "@/lib/services/calls";
import {
  detectFormsFromTranscript,
  storeFormMatchingResults,
  auditFormMatching,
  getStoredFormMatches,
  getSuggestedForms,
} from "@/lib/services/call-ml-integration";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/match-forms - Trigger ML form matching on a call
 *
 * Runs the ML matching service against the call's transcript to identify
 * forms that may be relevant. Returns matched forms with confidence scores.
 *
 * Query params:
 * - refresh: boolean - Force re-run even if results exist
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    // Verify call exists and user has access
    const call = await getCallById(callId, user.orgId);

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Check if we have cached results and don't need to refresh
    if (!refresh) {
      const existingMatches = await getStoredFormMatches(callId);
      if (existingMatches && existingMatches.length > 0) {
        const suggestedForms = getSuggestedForms(existingMatches);
        const autoSuggested = existingMatches.find((m) => m.isAutoSuggested);

        return NextResponse.json({
          success: true,
          data: {
            callId,
            matches: existingMatches,
            suggestedForms,
            autoSuggestedForm: autoSuggested || null,
            totalMatches: existingMatches.length,
            cached: true,
          },
        });
      }
    }

    // Verify call has a transcript
    if (!call.transcriptRaw) {
      return NextResponse.json(
        {
          error: {
            code: "NO_TRANSCRIPT",
            message: "Call has no transcript. Process the call first.",
          },
        },
        { status: 400 }
      );
    }

    // Run ML form matching
    const result = await detectFormsFromTranscript(
      call.transcriptRaw,
      user.orgId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "ML_SERVICE_ERROR",
            message: result.error || "Form matching failed",
          },
        },
        { status: 503 }
      );
    }

    // Store results
    await storeFormMatchingResults(callId, result);

    // Emit audit event
    await auditFormMatching(user.orgId, user.id, callId, result);

    const suggestedForms = getSuggestedForms(result.matches);
    const autoSuggested = result.matches.find((m) => m.isAutoSuggested);

    return NextResponse.json({
      success: true,
      data: {
        callId,
        matches: result.matches,
        suggestedForms,
        autoSuggestedForm: autoSuggested || null,
        totalMatches: result.matches.length,
        totalFormsChecked: result.totalFormsChecked,
        processingTimeMs: result.processingTimeMs,
        mlServiceUsed: result.mlServiceUsed,
        cached: false,
      },
    });
  } catch (error) {
    console.error("Error matching forms for call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to match forms" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/:callId/match-forms - Get stored form matches for a call
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

    const matches = await getStoredFormMatches(callId);

    if (!matches) {
      return NextResponse.json({
        success: true,
        data: {
          callId,
          matches: [],
          suggestedForms: [],
          autoSuggestedForm: null,
          totalMatches: 0,
          hasResults: false,
        },
      });
    }

    const suggestedForms = getSuggestedForms(matches);
    const autoSuggested = matches.find((m) => m.isAutoSuggested);

    return NextResponse.json({
      success: true,
      data: {
        callId,
        matches,
        suggestedForms,
        autoSuggestedForm: autoSuggested || null,
        totalMatches: matches.length,
        hasResults: true,
      },
    });
  } catch (error) {
    console.error("Error getting form matches for call:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get form matches" } },
      { status: 500 }
    );
  }
}
