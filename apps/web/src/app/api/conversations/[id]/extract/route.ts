import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";
import { createAuditLog } from "@/lib/audit/service";
import {
  runMultiFormExtraction,
  getFormFieldsForExtraction,
} from "@/lib/services/multi-form-extraction";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/extract
 *
 * Get current extraction results for a conversation.
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

    // Get conversation with extraction data
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
        extractedFields: true,
        confidenceScores: true,
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

    // Get form metadata for the linked forms
    const formGroups = await getFormFieldsForExtraction(
      conversation.formIds,
      user.orgId
    );

    return NextResponse.json({
      conversationId,
      formIds: conversation.formIds,
      forms: formGroups.map((g) => ({
        formId: g.formId,
        formName: g.formName,
        formType: g.formType,
        fieldCount: g.fields.length,
      })),
      extractedFields: conversation.extractedFields,
      confidenceScores: conversation.confidenceScores,
      hasExtraction: !!conversation.extractedFields,
    });
  } catch (error) {
    console.error("[Extract] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get extraction data" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/:id/extract
 *
 * Trigger multi-form extraction for a conversation.
 * Extracts data from transcript into all linked forms.
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

    // Verify conversation exists and has necessary data
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
        transcriptRaw: true,
        status: true,
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

    // Validate prerequisites
    if (!conversation.transcriptRaw) {
      return NextResponse.json(
        {
          error: {
            code: "NO_TRANSCRIPT",
            message: "Conversation has no transcript. Wait for processing to complete.",
          },
        },
        { status: 400 }
      );
    }

    if (conversation.formIds.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_FORMS",
            message: "No forms are linked to this conversation. Add forms before extracting.",
          },
        },
        { status: 400 }
      );
    }

    // Run extraction
    const result = await runMultiFormExtraction(conversationId);

    // Audit log for AI processing
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "CONVERSATION",
      resourceId: conversationId,
      details: {
        operation: "multi_form_extraction",
        formCount: conversation.formIds.length,
        success: result.success,
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
        extractedFieldCount: result.forms.reduce((sum, f) => sum + f.fields.length, 0),
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "EXTRACTION_FAILED",
            message: result.error || "Failed to extract data from transcript",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      forms: result.forms.map((f) => ({
        formId: f.formId,
        formName: f.formName,
        fieldCount: f.fields.length,
        overallConfidence: f.overallConfidence,
        fields: f.fields,
      })),
      tokensUsed: result.tokensUsed,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    console.error("[Extract] POST Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to run extraction" } },
      { status: 500 }
    );
  }
}
