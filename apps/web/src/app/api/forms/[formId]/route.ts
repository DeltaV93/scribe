import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getFormById,
  updateForm,
  archiveForm,
  deleteForm,
} from "@/lib/services/forms";
import { FormType } from "@/types";
import { z } from "zod";

// Validation schema for updating a form
const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  type: z.nativeEnum(FormType).optional(),
  settings: z
    .object({
      allowPartialSaves: z.boolean().optional(),
      requireSupervisorReview: z.boolean().optional(),
      autoArchiveDays: z.number().nullable().optional(),
      activityTriggers: z
        .array(z.enum(["submissions", "edits", "views"]))
        .optional(),
    })
    .optional(),
});

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * GET /api/forms/[formId] - Get a single form with all fields
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

    if (!user.permissions.canReadForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view forms" } },
        { status: 403 }
      );
    }

    const form = await getFormById(formId, user.orgId);

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: form });
  } catch (error) {
    console.error("Error getting form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get form" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/forms/[formId] - Update form metadata
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
    const validation = updateFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid form data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const form = await updateForm(formId, user.orgId, validation.data);

    return NextResponse.json({ success: true, data: form });
  } catch (error) {
    console.error("Error updating form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update form" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/forms/[formId] - Archive or delete a form
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

    if (!user.permissions.canDeleteForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete forms" } },
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

    // Check if permanent delete is requested
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      // Only draft forms can be permanently deleted
      await deleteForm(formId, user.orgId);
      return NextResponse.json({
        success: true,
        message: "Form permanently deleted",
      });
    } else {
      // Archive the form
      await archiveForm(formId, user.orgId);
      return NextResponse.json({
        success: true,
        message: "Form archived",
      });
    }
  } catch (error) {
    console.error("Error deleting form:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete form";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
