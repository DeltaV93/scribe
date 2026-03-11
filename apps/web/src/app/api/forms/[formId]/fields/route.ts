import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getFormById,
  addField,
  syncFormFields,
  reorderFields,
} from "@/lib/services/forms";
import { FieldType, FieldPurpose, type FormFieldData } from "@/types";
import { z } from "zod";

// Validation schema for a single field
const fieldSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  type: z.nativeEnum(FieldType),
  purpose: z.nativeEnum(FieldPurpose),
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
  order: z.number().int().min(0),
  conditionalLogic: z.any().nullable().optional(),
});

// Validation for creating a single field
const createFieldSchema = fieldSchema.omit({ id: true }).extend({
  formId: z.string().uuid(),
});

// Validation for syncing all fields
const syncFieldsSchema = z.object({
  fields: z.array(fieldSchema),
});

// Validation for reordering fields
const reorderFieldsSchema = z.object({
  fieldOrders: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    })
  ),
});

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * POST /api/forms/[formId]/fields - Add a single field or sync all fields
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

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

    const body = await request.json();

    // Check if this is a sync operation (has "fields" array)
    if ("fields" in body) {
      const validation = syncFieldsSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid fields data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      // Transform to FormFieldData format
      const fieldsToSync: FormFieldData[] = validation.data.fields.map((f) => ({
        ...f,
        formId,
        purposeNote: f.purposeNote ?? null,
        helpText: f.helpText ?? null,
        isRequired: f.isRequired ?? false,
        isSensitive: f.isSensitive ?? false,
        isAiExtractable: f.isAiExtractable ?? true,
        options: f.options ?? null,
        section: f.section ?? null,
        conditionalLogic: f.conditionalLogic ?? null,
        translations: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await syncFormFields(formId, fieldsToSync);

      // Return updated form
      const updatedForm = await getFormById(formId, user.orgId);
      return NextResponse.json({ success: true, data: updatedForm });
    }

    // Single field creation
    const fieldData = { ...body, formId };
    const validation = createFieldSchema.safeParse(fieldData);

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

    const field = await addField({
      formId,
      slug: validation.data.slug,
      name: validation.data.name,
      type: validation.data.type,
      purpose: validation.data.purpose,
      purposeNote: validation.data.purposeNote,
      helpText: validation.data.helpText,
      isRequired: validation.data.isRequired,
      isSensitive: validation.data.isSensitive,
      isAiExtractable: validation.data.isAiExtractable,
      options: validation.data.options,
      section: validation.data.section,
      order: validation.data.order,
      conditionalLogic: validation.data.conditionalLogic,
    });

    return NextResponse.json({ success: true, data: field }, { status: 201 });
  } catch (error) {
    console.error("Error adding field:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add field" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/forms/[formId]/fields - Reorder fields
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

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

    const body = await request.json();
    const validation = reorderFieldsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid reorder data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    await reorderFields(formId, validation.data.fieldOrders);

    // Return updated form
    const updatedForm = await getFormById(formId, user.orgId);
    return NextResponse.json({ success: true, data: updatedForm });
  } catch (error) {
    console.error("Error reordering fields:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to reorder fields" } },
      { status: 500 }
    );
  }
}
