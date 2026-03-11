import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { validateImport, importForm, previewImport, type ImportOptions } from "@/lib/forms/import";

/**
 * POST /api/forms/import
 *
 * Import a form from exported JSON
 *
 * Body:
 * - data: The exported form data
 * - preview: boolean - If true, only validate and preview
 * - options: ImportOptions - Import customization options
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { data: importData, preview = false, options = {} } = body;

    if (!importData) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Import data is required" } },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true, orgId: true, canCreateForms: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    if (!user.canCreateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You don't have permission to create forms" } },
        { status: 403 }
      );
    }

    // Validate the import data
    const validation = validateImport(importData);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          validation: {
            valid: false,
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
        { status: 400 }
      );
    }

    // If preview mode, return validation results and preview
    if (preview) {
      const previewResult = previewImport(validation.data!, options as ImportOptions);

      return NextResponse.json({
        success: true,
        data: {
          validation: {
            valid: true,
            errors: [],
            warnings: validation.warnings,
          },
          preview: previewResult,
        },
      });
    }

    // Perform the actual import
    const result = await importForm(
      user.orgId,
      user.id,
      validation.data!,
      options as ImportOptions
    );

    return NextResponse.json({
      success: true,
      data: {
        formId: result.formId,
        fieldCount: result.fieldCount,
        validation: {
          valid: true,
          errors: [],
          warnings: validation.warnings,
        },
      },
    });
  } catch (error) {
    console.error("Error importing form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to import form" } },
      { status: 500 }
    );
  }
}
