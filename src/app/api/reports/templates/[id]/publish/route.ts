import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publishReportTemplate } from "@/lib/services/reports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reports/templates/[id]/publish - Publish a report template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await publishReportTemplate(id, user.id, user.orgId);

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error("Error publishing report template:", error);

    if (error instanceof Error) {
      if (error.message === "Template not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message === "Access denied") {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to publish template" } },
      { status: 500 }
    );
  }
}
