import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { exportFilledForm } from "@/lib/services/form-conversion/pdf-export";
import { prisma } from "@/lib/db";
import { AuditLogger } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ formId: string }>;
}

// Validation schema for export options
const exportSchema = z.object({
  submissionId: z.string().uuid(),
  includeEmptyFields: z.boolean().optional(),
  dateFormat: z.string().optional(),
  fontSize: z.number().min(6).max(24).optional(),
  fontColor: z.string().optional(),
});

/**
 * POST /api/forms/[formId]/export-filled - Export a filled form as PDF
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { formId } = await params;

    // Get form to verify access
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: {
        id: true,
        orgId: true,
        name: true,
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    if (form.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = exportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid export options",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Verify submission exists and belongs to this form/org
    const submission = await prisma.formSubmission.findUnique({
      where: { id: validation.data.submissionId },
      select: {
        id: true,
        formId: true,
        orgId: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Submission not found" } },
        { status: 404 }
      );
    }

    if (submission.formId !== formId || submission.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Generate PDF
    const pdfBuffer = await exportFilledForm(formId, validation.data.submissionId, {
      includeEmptyFields: validation.data.includeEmptyFields,
      dateFormat: validation.data.dateFormat,
      fontSize: validation.data.fontSize,
      fontColor: validation.data.fontColor,
    });

    // Create filename
    const sanitizedName = form.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
    const filename = `${sanitizedName}_filled_${Date.now()}.pdf`;

    // Audit log the export
    await AuditLogger.dataExported(
      user.orgId,
      user.id,
      "SUBMISSION",
      validation.data.submissionId,
      "PDF"
    );

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting filled form:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export form" } },
      { status: 500 }
    );
  }
}
