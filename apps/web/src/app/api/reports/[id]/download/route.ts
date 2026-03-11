import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getReportPdfUrl } from "@/lib/services/reports/storage";
import { logCrossOrgAccess } from "@/lib/services/reports/cross-org-audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/[id]/download - Get a download URL for the report PDF
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        status: true,
        pdfPath: true,
        template: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Report not found" } },
        { status: 404 }
      );
    }

    // Check access
    if (report.orgId !== user.orgId) {
      await logCrossOrgAccess({
        action: "REPORT_DOWNLOAD",
        userId: user.id,
        userOrgId: user.orgId,
        targetOrgId: report.orgId,
        resourceType: "Report",
        resourceId: id,
      });
    }

    if (report.status !== "COMPLETED") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Report is not yet complete" } },
        { status: 400 }
      );
    }

    if (!report.pdfPath) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PDF not available" } },
        { status: 404 }
      );
    }

    const downloadUrl = await getReportPdfUrl(id);

    if (!downloadUrl) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "PDF file not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        downloadUrl,
        filename: `${report.template.name.replace(/[^a-zA-Z0-9]/g, "_")}_${id.slice(0, 8)}.pdf`,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    console.error("Error getting report download URL:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get download URL" } },
      { status: 500 }
    );
  }
}
