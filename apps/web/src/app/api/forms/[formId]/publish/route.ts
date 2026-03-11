import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFormById, publishForm } from "@/lib/services/forms";

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * POST /api/forms/[formId]/publish - Publish a form
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

    // Check publish permission
    if (!user.permissions.canPublishForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to publish forms" } },
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

    // Validate form is ready for publishing
    if (!existingForm.name?.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Form must have a name to publish" } },
        { status: 400 }
      );
    }

    if (existingForm.fields.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Form must have at least one field to publish" } },
        { status: 400 }
      );
    }

    // Check all fields have names
    const fieldsWithoutNames = existingForm.fields.filter((f) => !f.name?.trim());
    if (fieldsWithoutNames.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `${fieldsWithoutNames.length} field(s) are missing names`,
            details: { fieldIds: fieldsWithoutNames.map((f) => f.id) },
          },
        },
        { status: 400 }
      );
    }

    // Check dropdown/checkbox fields have options
    const fieldsWithoutOptions = existingForm.fields.filter(
      (f) =>
        (f.type === "DROPDOWN" || f.type === "CHECKBOX") &&
        (!f.options || f.options.length === 0)
    );
    if (fieldsWithoutOptions.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `${fieldsWithoutOptions.length} dropdown/checkbox field(s) are missing options`,
            details: { fieldIds: fieldsWithoutOptions.map((f) => f.id) },
          },
        },
        { status: 400 }
      );
    }

    // Publish the form
    const result = await publishForm(formId, user.orgId, user.id);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Form published as version ${result.version.version}`,
    });
  } catch (error) {
    console.error("Error publishing form:", error);
    const message =
      error instanceof Error ? error.message : "Failed to publish form";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
