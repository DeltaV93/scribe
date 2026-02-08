import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFormData } from "@/lib/ai/extraction";
import type { ExtractableField } from "@/lib/ai/types";

interface RouteParams {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/[callId]/extract - Extract form data from call transcript
 *
 * Runs AI extraction on the call transcript against a specified form's fields.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    const body = await request.json();
    const { formId } = body;

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

    // Run extraction
    const result = await extractFormData(extractableFields, call.transcriptRaw);

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
