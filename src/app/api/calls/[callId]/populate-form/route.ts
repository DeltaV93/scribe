import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditLogger } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ callId: string }>;
}

interface FieldValue {
  fieldId: string;
  value: string | number | boolean | string[] | null;
}

/**
 * POST /api/calls/[callId]/populate-form - Create form submission from extraction
 *
 * Takes reviewed/corrected extraction data and creates a FormSubmission.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { callId } = await params;

    const body = await request.json();
    const { formId, fields } = body as { formId: string; fields: FieldValue[] };

    if (!formId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "formId is required" } },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "fields array is required" } },
        { status: 400 }
      );
    }

    // Verify call exists and belongs to org
    const call = await prisma.call.findFirst({
      where: { id: callId, client: { orgId: user.orgId } },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Verify form exists and get current version
    const form = await prisma.form.findFirst({
      where: { id: formId, orgId: user.orgId },
      include: {
        fields: {
          select: { id: true, slug: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    // Get the latest version for the form
    const currentVersion = await prisma.formVersion.findFirst({
      where: { formId },
      orderBy: { version: "desc" },
    });

    if (!currentVersion) {
      return NextResponse.json(
        { error: { code: "NO_VERSION", message: "Form has no published version" } },
        { status: 400 }
      );
    }

    // Build responses object keyed by field slug
    const responses: Record<string, unknown> = {};
    for (const fieldValue of fields) {
      const field = form.fields.find((f: { id: string }) => f.id === fieldValue.fieldId);
      if (field) {
        responses[(field as { id: string; slug: string }).slug] = fieldValue.value;
      }
    }

    // Create form submission
    const submission = await prisma.formSubmission.create({
      data: {
        formId,
        formVersionId: currentVersion.id,
        orgId: user.orgId,
        clientId: call.clientId,
        submittedById: user.id,
        data: responses as object,
        aiExtractedData: responses as object,
        callId: call.id,
        status: "SUBMITTED",
        isComplete: true,
        isDraft: false,
        submittedAt: new Date(),
      },
    });

    // Audit log
    await AuditLogger.submissionCreated(
      user.orgId,
      user.id,
      submission.id,
      formId
    );

    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        callId,
        formId,
        clientId: call.clientId,
      },
    });
  } catch (error) {
    console.error("Error populating form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create form submission" } },
      { status: 500 }
    );
  }
}
