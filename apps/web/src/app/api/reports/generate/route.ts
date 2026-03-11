import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { generateReport } from "@/lib/services/reports";

// Validation schema for report generation
const generateReportSchema = z.object({
  templateId: z.string().uuid(),
  reportingPeriod: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  programIds: z.array(z.string().uuid()).optional(),
  async: z.boolean().optional(),
});

/**
 * POST /api/reports/generate - Generate a report from a template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

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

    const { templateId, reportingPeriod, programIds } = validation.data;

    const result = await generateReport({
      templateId,
      orgId: user.orgId,
      userId: user.id,
      reportingPeriod: {
        start: new Date(reportingPeriod.start),
        end: new Date(reportingPeriod.end),
      },
      programIds,
      async: validation.data.async ?? true,
    });

    return NextResponse.json(
      { data: result },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error generating report:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate report" } },
      { status: 500 }
    );
  }
}
