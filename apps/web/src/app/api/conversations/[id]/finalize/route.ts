import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import type { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface FieldEdit {
  [fieldSlug: string]: unknown;
}

interface FormEdits {
  [formId: string]: FieldEdit;
}

interface FinalizeBody {
  edits?: FormEdits;
  clientId?: string; // Optional: link all submissions to this client
  clientIds?: Record<string, string>; // Optional: per-form client IDs
}

/**
 * POST /api/conversations/:id/finalize
 *
 * Create FormSubmission records from extracted conversation data.
 * Optionally applies edits and links to clients.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: conversationId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, conversationId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Parse request body
    const body = (await request.json().catch(() => ({}))) as FinalizeBody;
    const { edits = {}, clientId, clientIds = {} } = body;

    // Get conversation with extraction data
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
        extractedFields: true,
        formSubmissions: {
          select: { id: true, formId: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Check for extracted data
    const extractedData = conversation.extractedFields as {
      forms?: Record<
        string,
        {
          formName: string;
          fields: Record<
            string,
            {
              fieldId: string;
              value: unknown;
              confidence: number;
              needsReview: boolean;
            }
          >;
        }
      >;
    } | null;

    if (!extractedData?.forms) {
      return NextResponse.json(
        {
          error: {
            code: "NO_EXTRACTION",
            message: "No extraction data found. Run extraction first.",
          },
        },
        { status: 400 }
      );
    }

    // Check if submissions already exist
    const existingFormIds = new Set(
      conversation.formSubmissions.map((s) => s.formId)
    );
    const formsToCreate = conversation.formIds.filter(
      (fid) => !existingFormIds.has(fid)
    );

    if (formsToCreate.length === 0 && conversation.formSubmissions.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_FINALIZED",
            message: "Form submissions already exist for this conversation.",
          },
        },
        { status: 400 }
      );
    }

    // Get form details for version IDs
    const forms = await prisma.form.findMany({
      where: {
        id: { in: formsToCreate },
        orgId: user.orgId,
      },
      select: {
        id: true,
        name: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true },
        },
        fields: {
          select: {
            id: true,
            slug: true,
            isSensitive: true,
          },
        },
      },
    });

    // Validate client IDs if provided
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: user.orgId, deletedAt: null },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: { code: "INVALID_CLIENT", message: "Client not found" } },
          { status: 400 }
        );
      }
    }

    // Create submissions
    const createdSubmissions: Array<{
      id: string;
      formId: string;
      formName: string;
    }> = [];

    for (const form of forms) {
      const activeVersion = form.versions[0];
      if (!activeVersion) {
        console.warn(`[Finalize] No active version for form ${form.id}`);
        continue;
      }

      const formExtraction = extractedData.forms[form.id];
      if (!formExtraction) {
        console.warn(`[Finalize] No extraction data for form ${form.id}`);
        continue;
      }

      // Build submission data from extraction + edits
      const submissionData: Record<string, unknown> = {};
      const confidenceData: Record<string, number> = {};
      const flaggedFields: string[] = [];

      for (const field of form.fields) {
        const extraction = formExtraction.fields[field.slug];
        const editValue = edits[form.id]?.[field.slug];

        // Use edit value if provided, otherwise use extracted value
        const finalValue = editValue !== undefined ? editValue : extraction?.value;

        if (finalValue !== null && finalValue !== undefined) {
          submissionData[field.slug] = finalValue;
        }

        if (extraction) {
          confidenceData[field.slug] = extraction.confidence;
          if (extraction.needsReview) {
            flaggedFields.push(field.slug);
          }
        }
      }

      // Determine client ID for this form
      const formClientId = clientIds[form.id] || clientId || null;

      // Create the submission
      const submission = await prisma.formSubmission.create({
        data: {
          orgId: user.orgId,
          formId: form.id,
          formVersionId: activeVersion.id,
          conversationId,
          clientId: formClientId,
          data: submissionData as Prisma.InputJsonValue,
          aiExtractedData: formExtraction as unknown as Prisma.InputJsonValue,
          aiConfidence: confidenceData as Prisma.InputJsonValue,
          flaggedFields,
          status: "DRAFT",
          isDraft: true,
          isComplete: false,
          submittedById: user.id,
        },
        select: {
          id: true,
          formId: true,
        },
      });

      createdSubmissions.push({
        id: submission.id,
        formId: form.id,
        formName: form.name,
      });
    }

    // Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "CREATE",
      resource: "FORM_SUBMISSION",
      resourceId: conversationId,
      details: {
        operation: "finalize_conversation",
        conversationId,
        submissionsCreated: createdSubmissions.length,
        formIds: createdSubmissions.map((s) => s.formId),
        clientId: clientId || null,
      },
    });

    return NextResponse.json({
      success: true,
      submissions: createdSubmissions,
      message: `Created ${createdSubmissions.length} form submission(s)`,
    });
  } catch (error) {
    console.error("[Finalize] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to finalize" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/:id/finalize
 *
 * Get finalization status - check if submissions already exist.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: conversationId } = await params;

    // Check access
    const accessResult = await canAccessConversation(user.id, conversationId);
    if (!accessResult.hasAccess) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: accessResult.reason } },
        { status: 403 }
      );
    }

    // Get conversation with submissions
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
        formSubmissions: {
          select: {
            id: true,
            formId: true,
            status: true,
            clientId: true,
            createdAt: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const isFinalized = conversation.formSubmissions.length > 0;

    return NextResponse.json({
      conversationId,
      isFinalized,
      submissions: conversation.formSubmissions.map((s) => ({
        id: s.id,
        formId: s.formId,
        status: s.status,
        clientId: s.clientId,
        clientName: s.client
          ? `${s.client.firstName} ${s.client.lastName}`
          : null,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("[Finalize] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get status" } },
      { status: 500 }
    );
  }
}
