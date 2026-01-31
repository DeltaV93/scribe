import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  getReportTypes,
  getQuestionnaire,
  validateAnswers,
  getMetricSuggestions,
} from "@/lib/services/reports";
import { ReportType } from "@prisma/client";

/**
 * GET /api/reports/questionnaire - Get available report types
 */
export async function GET() {
  try {
    await requireAuth();

    const reportTypes = getReportTypes();

    return NextResponse.json({
      data: reportTypes,
    });
  } catch (error) {
    console.error("Error getting report types:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get report types" } },
      { status: 500 }
    );
  }
}

// Validation schema for questionnaire submission
const submitQuestionnaireSchema = z.object({
  reportType: z.enum([
    "HUD_APR",
    "DOL_WORKFORCE",
    "CALI_GRANTS",
    "BOARD_REPORT",
    "IMPACT_REPORT",
    "CUSTOM",
  ]),
  answers: z.record(z.unknown()),
  getSuggestions: z.boolean().optional(),
  funderRequirements: z.string().optional(),
});

/**
 * POST /api/reports/questionnaire - Submit questionnaire answers and get metric suggestions
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const validation = submitQuestionnaireSchema.safeParse(body);

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

    const { reportType, answers, getSuggestions, funderRequirements } = validation.data;

    // Validate questionnaire answers
    const questionnaire = getQuestionnaire(reportType as ReportType);
    const answerValidation = validateAnswers(questionnaire, answers);

    if (!answerValidation.isValid) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid questionnaire answers",
            details: answerValidation.errors,
          },
        },
        { status: 400 }
      );
    }

    // Get metric suggestions if requested
    let suggestions = null;
    if (getSuggestions) {
      suggestions = await getMetricSuggestions(
        reportType as ReportType,
        answers,
        funderRequirements
      );
    }

    return NextResponse.json({
      data: {
        valid: true,
        suggestions,
      },
    });
  } catch (error) {
    console.error("Error processing questionnaire:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process questionnaire" } },
      { status: 500 }
    );
  }
}
