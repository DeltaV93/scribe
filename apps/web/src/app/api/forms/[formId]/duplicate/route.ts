import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFormById, duplicateForm } from "@/lib/services/forms";
import { z } from "zod";

const duplicateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * POST /api/forms/[formId]/duplicate - Duplicate a form
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

    if (!user.permissions.canCreateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create forms" } },
        { status: 403 }
      );
    }

    // Verify form exists and belongs to org
    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    // Parse optional new name
    let newName: string | undefined;
    try {
      const body = await request.json();
      const validation = duplicateSchema.safeParse(body);
      if (validation.success) {
        newName = validation.data.name;
      }
    } catch {
      // No body provided, use default name
    }

    const duplicatedForm = await duplicateForm(
      formId,
      user.orgId,
      user.id,
      newName
    );

    return NextResponse.json(
      {
        success: true,
        data: duplicatedForm,
        message: "Form duplicated successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error duplicating form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to duplicate form" } },
      { status: 500 }
    );
  }
}
