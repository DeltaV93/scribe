import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { getMetricSuggestions } from "@/lib/services/reports";
import { ReportType } from "@prisma/client";

// Validation schema for metric suggestions
const suggestMetricsSchema = z.object({
  reportType: z.enum([
    "HUD_APR",
    "DOL_WORKFORCE",
    "CALI_GRANTS",
    "BOARD_REPORT",
    "IMPACT_REPORT",
    "CUSTOM",
  ]),
  questionnaireAnswers: z.record(z.unknown()),
  funderRequirements: z.string().optional(),
  existingMetricIds: z.array(z.string()).optional(),
});

/**
 * POST /api/reports/suggest-metrics - Get AI-powered metric suggestions
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const validation = suggestMetricsSchema.safeParse(body);

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

    const suggestions = await getMetricSuggestions(
      validation.data.reportType as ReportType,
      validation.data.questionnaireAnswers,
      validation.data.funderRequirements
    );

    return NextResponse.json({ data: suggestions });
  } catch (error) {
    console.error("Error getting metric suggestions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get suggestions" } },
      { status: 500 }
    );
  }
}
