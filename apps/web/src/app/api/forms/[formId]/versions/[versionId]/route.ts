import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getFormById, getFormVersion, revertToVersion } from "@/lib/services/forms";

interface RouteParams {
  params: Promise<{ formId: string; versionId: string }>;
}

/**
 * GET /api/forms/[formId]/versions/[versionId] - Get a specific version
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId, versionId } = await params;

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

    const version = await getFormVersion(versionId);

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error("Error getting form version:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get form version";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forms/[formId]/versions/[versionId]/revert - Revert to a specific version
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId, versionId } = await params;

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

    const form = await revertToVersion(formId, versionId, user.orgId);

    return NextResponse.json({
      success: true,
      data: form,
      message: "Form reverted to selected version and set to draft status",
    });
  } catch (error) {
    console.error("Error reverting form version:", error);
    const message =
      error instanceof Error ? error.message : "Failed to revert form version";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
