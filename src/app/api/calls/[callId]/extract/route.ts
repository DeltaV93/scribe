import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFormData } from "@/lib/ai/extraction";
import type { ExtractableField } from "@/lib/ai/types";
import { auditFormSelection } from "@/lib/services/call-ml-integration";

interface RouteParams {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/[callId]/extract - Extract form data from call transcript
 *
 * Runs AI extraction on the call transcript against a specified form's fields.
 * Optionally uses ML segment detection to focus extraction on relevant parts.
 *
 * Body:
 * - formId: string (required) - Form to extract data for
 * - useSegments: boolean (optional) - Use ML segment detection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    const body = await request.json();
    const { formId, useSegments = false } = body;

    if (!formId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "formId is required" } },
        { status: 400 }
      );
    }

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: { id: callId, client: { orgId: user.orgId } },
      select: {
        id: true,
        transcriptRaw: true,
        clientId: true,
        mlMatchedForms: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    if (!call.transcriptRaw) {
      return NextResponse.json(
        { error: { code: "NO_TRANSCRIPT", message: "Call has no transcript" } },
        { status: 400 }
      );
    }

    // Get form and its fields
    const form = await prisma.form.findFirst({
      where: { id: formId, orgId: user.orgId },
      include: {
        fields: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            purpose: true,
            helpText: true,
            isRequired: true,
            options: true,
          },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    // Convert fields to extractable format
    const extractableFields: ExtractableField[] = form.fields.map((field) => ({
      id: field.id,
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose || "OTHER",
      helpText: field.helpText,
      isRequired: field.isRequired,
      options: field.options as { value: string; label: string }[] | null,
    }));

    // Check if this form was ML-matched and get match details
    let mlMatchInfo: {
      confidence: number | null;
      wasAutoSuggested: boolean;
    } = { confidence: null, wasAutoSuggested: false };

    const mlMatches = call.mlMatchedForms as unknown as Array<{
      formId: string;
      confidence: number;
      isAutoSuggested: boolean;
    }> | null;

    if (mlMatches) {
      const match = mlMatches.find((m) => m.formId === formId);
      if (match) {
        mlMatchInfo = {
          confidence: match.confidence,
          wasAutoSuggested: match.isAutoSuggested,
        };
      }
    }

    // Determine transcript text to use (may use segment boundaries in future)
    let transcriptText = call.transcriptRaw;
    // TODO: If useSegments is true and we have segment data for this form,
    // we could filter the transcript to only the relevant segment.
    // For now, we use the full transcript.

    // Run extraction
    const result = await extractFormData(extractableFields, transcriptText);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "EXTRACTION_FAILED", message: result.error || "Extraction failed" } },
        { status: 500 }
      );
    }

    // Merge field metadata with extraction results
    const fieldsWithMetadata = result.fields.map((extraction) => {
      const field = form.fields.find((f) => f.id === extraction.fieldId);
      return {
        ...extraction,
        name: field?.name || extraction.slug,
        type: field?.type || "TEXT_SHORT",
        options: field?.options as { value: string; label: string }[] | undefined,
        isRequired: field?.isRequired || false,
      };
    });

    // Emit audit event for form selection
    try {
      await auditFormSelection(
        user.orgId,
        user.id,
        callId,
        formId,
        form.name,
        mlMatchInfo.confidence,
        mlMatchInfo.wasAutoSuggested
      );
    } catch (auditError) {
      // Log but don't fail - audit is non-critical
      console.error("Failed to emit form selection audit:", auditError);
    }

    return NextResponse.json({
      success: true,
      data: {
        callId,
        formId,
        formName: form.name,
        clientId: call.clientId,
        overallConfidence: result.overallConfidence,
        fields: fieldsWithMetadata,
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
        // ML matching context
        mlMatchInfo: {
          wasMLMatched: mlMatchInfo.confidence !== null,
          mlConfidence: mlMatchInfo.confidence,
          wasAutoSuggested: mlMatchInfo.wasAutoSuggested,
        },
      },
    });
  } catch (error) {
    console.error("Error extracting form data:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to extract form data" } },
      { status: 500 }
    );
  }
}
