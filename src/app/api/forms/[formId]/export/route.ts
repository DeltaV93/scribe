import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { exportFormToJson, exportFormToHtml } from "@/lib/forms/export";

interface RouteParams {
  params: Promise<{ formId: string }>;
}

/**
 * GET /api/forms/:formId/export
 *
 * Export a form to JSON or HTML format
 *
 * Query params:
 * - format: "json" (default) or "html"
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { formId } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get user's org
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { orgId: true, canReadForms: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    if (!user.canReadForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You don't have permission to read forms" } },
        { status: 403 }
      );
    }

    // Verify form belongs to user's org
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        orgId: user.orgId,
      },
      select: { name: true },
    });

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    // Get format from query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    if (format === "html") {
      const html = await exportFormToHtml(formId);

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(form.name)}.html"`,
        },
      });
    } else {
      const exportData = await exportFormToJson(formId);

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(form.name)}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting form:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export form" } },
      { status: 500 }
    );
  }
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100);
}
