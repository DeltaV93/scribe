import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/forms
 *
 * Get forms linked to this conversation.
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

    // Get conversation with form IDs
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Verify org ownership
    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Fetch form details
    const forms = await prisma.form.findMany({
      where: {
        id: { in: conversation.formIds },
        orgId: user.orgId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        _count: {
          select: { fields: true },
        },
      },
    });

    return NextResponse.json({
      conversationId,
      forms: forms.map((form) => ({
        id: form.id,
        name: form.name,
        type: form.type,
        status: form.status,
        fieldCount: form._count.fields,
      })),
    });
  } catch (error) {
    console.error("[ConversationForms] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get forms" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id/forms
 *
 * Add or remove forms from this conversation.
 * Body: { add?: string[], remove?: string[] }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();
    const { add = [], remove = [] } = body as {
      add?: string[];
      remove?: string[];
    };

    // Validate arrays
    if (!Array.isArray(add) || !Array.isArray(remove)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "add and remove must be arrays" } },
        { status: 400 }
      );
    }

    // Get current conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        orgId: true,
        formIds: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    // Verify org ownership
    if (conversation.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Validate that forms to add exist and belong to org
    if (add.length > 0) {
      const validForms = await prisma.form.findMany({
        where: {
          id: { in: add },
          orgId: user.orgId,
          status: "PUBLISHED",
          archivedAt: null,
        },
        select: { id: true },
      });

      const validIds = new Set(validForms.map((f) => f.id));
      const invalidIds = add.filter((id) => !validIds.has(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_FORMS",
              message: `Some forms are invalid or not published: ${invalidIds.join(", ")}`,
            },
          },
          { status: 400 }
        );
      }
    }

    // Calculate new form IDs
    let newFormIds = [...conversation.formIds];

    // Add new forms (avoid duplicates)
    for (const formId of add) {
      if (!newFormIds.includes(formId)) {
        newFormIds.push(formId);
      }
    }

    // Remove specified forms
    newFormIds = newFormIds.filter((id) => !remove.includes(id));

    // Update conversation
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { formIds: newFormIds },
      select: {
        id: true,
        formIds: true,
      },
    });

    // Fetch updated form details
    const forms = await prisma.form.findMany({
      where: {
        id: { in: updated.formIds },
        orgId: user.orgId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        _count: {
          select: { fields: true },
        },
      },
    });

    return NextResponse.json({
      conversationId,
      forms: forms.map((form) => ({
        id: form.id,
        name: form.name,
        type: form.type,
        status: form.status,
        fieldCount: form._count.fields,
      })),
      added: add.filter((id) => updated.formIds.includes(id)),
      removed: remove.filter((id) => conversation.formIds.includes(id) && !updated.formIds.includes(id)),
    });
  } catch (error) {
    console.error("[ConversationForms] PATCH Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update forms" } },
      { status: 500 }
    );
  }
}
