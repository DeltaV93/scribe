import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFormById, getFormVersions } from "@/lib/services/forms";

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * GET /api/forms/[formId]/versions - List all versions of a form
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

    // Verify form exists and belongs to org
    const existingForm = await getFormById(formId, user.orgId);
    if (!existingForm) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    const versions = await getFormVersions(formId, user.orgId);

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error("Error listing form versions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list form versions" } },
      { status: 500 }
    );
  }
}
