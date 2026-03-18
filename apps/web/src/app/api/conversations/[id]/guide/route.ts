import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessConversation } from "@/lib/services/conversation-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/:id/guide
 *
 * Get form fields for the conversation guide display.
 * Returns fields grouped by form with their sections.
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

    // No forms linked
    if (conversation.formIds.length === 0) {
      return NextResponse.json({
        conversationId,
        forms: [],
        totalFields: 0,
      });
    }

    // Fetch forms with fields
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
        fields: {
          orderBy: {
            order: "asc",
          },
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            isRequired: true,
            section: true,
            helpText: true,
            order: true,
          },
        },
      },
    });

    // Group fields by section within each form
    const formsWithSections = forms.map((form) => {
      // Get unique sections in order
      const sectionOrder: string[] = [];
      const sectionMap = new Map<string, typeof form.fields>();

      for (const field of form.fields) {
        const section = field.section || "General";
        if (!sectionMap.has(section)) {
          sectionOrder.push(section);
          sectionMap.set(section, []);
        }
        sectionMap.get(section)!.push(field);
      }

      return {
        id: form.id,
        name: form.name,
        type: form.type,
        sections: sectionOrder.map((sectionName) => ({
          name: sectionName,
          fields: sectionMap.get(sectionName)!.map((field) => ({
            id: field.id,
            key: field.slug,
            label: field.name,
            type: field.type,
            required: field.isRequired,
            helpText: field.helpText,
          })),
        })),
        fieldCount: form.fields.length,
      };
    });

    const totalFields = formsWithSections.reduce((sum, form) => sum + form.fieldCount, 0);

    return NextResponse.json({
      conversationId,
      forms: formsWithSections,
      totalFields,
    });
  } catch (error) {
    console.error("[ConversationGuide] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get guide data" } },
      { status: 500 }
    );
  }
}
