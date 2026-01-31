import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  createReportTemplate,
  listReportTemplates,
} from "@/lib/services/reports";
import { ReportType, ReportTemplateStatus } from "@prisma/client";

/**
 * GET /api/reports/templates - List report templates
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") as ReportTemplateStatus | null;
    const type = searchParams.get("type") as ReportType | null;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await listReportTemplates(user.orgId, {
      status: status || undefined,
      type: type || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      data: result.templates,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error listing report templates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list templates" } },
      { status: 500 }
    );
  }
}

// Validation schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum([
    "HUD_APR",
    "DOL_WORKFORCE",
    "CALI_GRANTS",
    "BOARD_REPORT",
    "IMPACT_REPORT",
    "CUSTOM",
  ]),
  questionnaireAnswers: z.record(z.unknown()),
  selectedMetricIds: z.array(z.string()),
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
 * POST /api/reports/templates - Create a new report template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);

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

    const template = await createReportTemplate({
      orgId: user.orgId,
      userId: user.id,
      name: validation.data.name,
      description: validation.data.description,
      type: validation.data.type as ReportType,
      questionnaireAnswers: validation.data.questionnaireAnswers,
      selectedMetricIds: validation.data.selectedMetricIds,
      sections: validation.data.sections,
      funderRequirements: validation.data.funderRequirements,
    });

    return NextResponse.json(
      { data: template },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating report template:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create template" } },
      { status: 500 }
    );
  }
}
