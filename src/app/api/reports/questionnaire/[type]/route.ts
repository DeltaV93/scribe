import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getQuestionnaire } from "@/lib/services/reports";
import { ReportType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ type: string }>;
}

const VALID_TYPES = [
  "HUD_APR",
  "DOL_WORKFORCE",
  "CALI_GRANTS",
  "BOARD_REPORT",
  "IMPACT_REPORT",
  "CUSTOM",
];

/**
 * GET /api/reports/questionnaire/[type] - Get questionnaire for a specific report type
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { type } = await params;

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: `Invalid report type: ${type}. Valid types: ${VALID_TYPES.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    const questionnaire = getQuestionnaire(type as ReportType);

    return NextResponse.json({
      data: questionnaire,
    });
  } catch (error) {
    console.error("Error getting questionnaire:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get questionnaire" } },
      { status: 500 }
    );
  }
}
