import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/templates/[id] - Get a report template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        publishedBy: {
          select: { name: true, email: true },
        },
        _count: {
          select: { reports: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found" } },
        { status: 404 }
      );
    }

    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error("Error getting report template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get template" } },
      { status: 500 }
    );
  }
}

// Validation schema for updating a template
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  questionnaireAnswers: z.record(z.unknown()).optional(),
  metrics: z.array(z.unknown()).optional(),
  sections: z
    .array(
      z.object({
        type: z.string(),
        title: z.string(),
        order: z.number(),
      })
    )
    .optional(),
  funderRequirements: z.record(z.unknown()).optional(),
});

/**
 * PUT /api/reports/templates/[id] - Update a report template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found" } },
        { status: 404 }
      );
    }

    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    if (template.status === "PUBLISHED") {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Cannot edit a published template" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description;
    if (validation.data.questionnaireAnswers) {
      updateData.questionnaireAnswers = validation.data.questionnaireAnswers as unknown as Prisma.InputJsonValue;
    }
    if (validation.data.metrics) {
      updateData.metrics = validation.data.metrics as unknown as Prisma.InputJsonValue;
    }
    if (validation.data.sections) {
      updateData.sections = validation.data.sections as unknown as Prisma.InputJsonValue;
    }
    if (validation.data.funderRequirements) {
      updateData.funderRequirements = validation.data.funderRequirements as unknown as Prisma.InputJsonValue;
    }

    const updated = await prisma.reportTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating report template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update template" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/templates/[id] - Archive a report template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await prisma.reportTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found" } },
        { status: 404 }
      );
    }

    if (template.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Archive the template instead of deleting
    await prisma.reportTemplate.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving report template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to archive template" } },
      { status: 500 }
    );
  }
}
