import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFormById, updateField, deleteField } from "@/lib/services/forms";
import { FieldType, FieldPurpose } from "@/types";
import { z } from "zod";

// Validation schema for updating a field
const updateFieldSchema = z.object({
  slug: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(FieldType).optional(),
  purpose: z.nativeEnum(FieldPurpose).optional(),
  purposeNote: z.string().max(500).nullable().optional(),
  helpText: z.string().max(500).nullable().optional(),
  isRequired: z.boolean().optional(),
  isSensitive: z.boolean().optional(),
  isAiExtractable: z.boolean().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      })
    )
    .nullable()
    .optional(),
  section: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).optional(),
  conditionalLogic: z.any().nullable().optional(),
});

interface RouteParams {
  params: Promise<{ formId: string; fieldId: string }>;
}

/**
 * PATCH /api/forms/[formId]/fields/[fieldId] - Update a field
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId, fieldId } = await params;

    if (!user.permissions.canUpdateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update forms" } },
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

    // Verify field exists in form
    const fieldExists = existingForm.fields.some((f) => f.id === fieldId);
    if (!fieldExists) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Field not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateFieldSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid field data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const field = await updateField(fieldId, validation.data);

    return NextResponse.json({ success: true, data: field });
  } catch (error) {
    console.error("Error updating field:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update field" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/[formId]/fields/[fieldId] - Delete a field
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId, fieldId } = await params;

    if (!user.permissions.canUpdateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update forms" } },
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

    // Verify field exists in form
    const fieldExists = existingForm.fields.some((f) => f.id === fieldId);
    if (!fieldExists) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Field not found" } },
        { status: 404 }
      );
    }

    await deleteField(fieldId);

    return NextResponse.json({ success: true, message: "Field deleted" });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete field" } },
      { status: 500 }
    );
  }
}
