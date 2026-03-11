import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  createNoteTemplate,
  listNoteTemplates,
  ALL_VARIABLE_KEYS,
} from "@/lib/services/note-templates";
import { NoteTemplateScope } from "@prisma/client";

// Validation schema for creating a note template
const createNoteTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  scope: z.nativeEnum(NoteTemplateScope),
  programId: z.string().uuid().optional(),
  sessionType: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /api/note-templates - List note templates for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") as NoteTemplateScope | null;
    const programId = searchParams.get("programId") ?? undefined;
    const sessionType = searchParams.get("sessionType") ?? undefined;

    const templates = await listNoteTemplates({
      orgId: user.orgId,
      scope: scope ?? undefined,
      programId,
      userId: scope === "USER" ? user.id : undefined,
      sessionType,
    });

    return NextResponse.json({
      success: true,
      data: templates,
      meta: {
        availableVariables: ALL_VARIABLE_KEYS,
      },
    });
  } catch (error) {
    console.error("Error listing note templates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list note templates" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/note-templates - Create a new note template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createNoteTemplateSchema.safeParse(body);

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

    // Validate scope-specific requirements
    if (validation.data.scope === "PROGRAM" && !validation.data.programId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "programId is required for PROGRAM scope",
          },
        },
        { status: 400 }
      );
    }

    const template = await createNoteTemplate({
      orgId: user.orgId,
      createdById: user.id,
      name: validation.data.name,
      content: validation.data.content,
      scope: validation.data.scope,
      programId: validation.data.programId,
      userId: validation.data.scope === "USER" ? user.id : undefined,
      sessionType: validation.data.sessionType,
      isDefault: validation.data.isDefault,
    });

    return NextResponse.json(
      { success: true, data: template },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating note template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create note template" } },
      { status: 500 }
    );
  }
}
