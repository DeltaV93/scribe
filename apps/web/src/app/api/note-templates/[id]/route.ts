import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  getNoteTemplate,
  updateNoteTemplate,
  deleteNoteTemplate,
} from "@/lib/services/note-templates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for updating a note template
const updateNoteTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  sessionType: z.string().max(100).optional().nullable(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /api/note-templates/[id] - Get a note template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await getNoteTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Note template not found" } },
        { status: 404 }
      );
    }

    // Verify the template belongs to the user's organization
    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Error getting note template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get note template" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/note-templates/[id] - Update a note template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await getNoteTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Note template not found" } },
        { status: 404 }
      );
    }

    // Verify the template belongs to the user's organization
    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateNoteTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid template data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const updated = await updateNoteTemplate(id, {
      name: validation.data.name,
      content: validation.data.content,
      sessionType: validation.data.sessionType ?? undefined,
      isDefault: validation.data.isDefault,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating note template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update note template" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/note-templates/[id] - Delete a note template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await getNoteTemplate(id);

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Note template not found" } },
        { status: 404 }
      );
    }

    // Verify the template belongs to the user's organization
    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    await deleteNoteTemplate(id);

    return NextResponse.json({
      success: true,
      message: "Note template deleted",
    });
  } catch (error) {
    console.error("Error deleting note template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete note template" } },
      { status: 500 }
    );
  }
}
