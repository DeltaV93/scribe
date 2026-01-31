import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listNoteTemplates, ALL_VARIABLE_KEYS } from "@/lib/services/note-templates";
import { AVAILABLE_VARIABLES, getVariablePreviews } from "@/lib/services/mass-notes";
import { NoteTemplateScope } from "@prisma/client";

/**
 * GET /api/mass-notes/templates - List note templates available for mass notes
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId") ?? undefined;
    const scope = searchParams.get("scope") as NoteTemplateScope | null;

    // Get templates with optional filtering
    const templates = await listNoteTemplates({
      orgId: user.orgId,
      programId,
      scope: scope ?? undefined,
    });

    // Get sample variable values for preview
    const variablePreviews = getVariablePreviews();

    return NextResponse.json({
      success: true,
      data: templates,
      meta: {
        availableVariables: AVAILABLE_VARIABLES,
        variablePreviews,
        variableKeys: ALL_VARIABLE_KEYS,
      },
    });
  } catch (error) {
    console.error("Error listing mass note templates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list templates" } },
      { status: 500 }
    );
  }
}
