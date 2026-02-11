import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseRequirements, parsePdfRequirements, diffDeliverables, generateClarifyingQuestions } from "@/lib/ai/goals/parse-requirements";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for parsing requirements
const parseRequirementsSchema = z.object({
  text: z.string().min(1, "Text is required").max(100000),
  existingDeliverables: z
    .array(
      z.object({
        name: z.string(),
        targetValue: z.number(),
        metricType: z.string(),
      })
    )
    .optional(),
  generateQuestions: z.boolean().optional(),
});

/**
 * POST /api/ai/parse-requirements - Parse funder document for deliverables
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only admins and program managers can use AI parsing
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to use AI parsing" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = parseRequirementsSchema.safeParse(body);

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

    const { text, existingDeliverables, generateQuestions } = validation.data;

    // Parse the requirements
    const parseResult = await parseRequirements(text);

    // If existing deliverables provided, compute diff
    let diff = null;
    if (existingDeliverables && existingDeliverables.length > 0) {
      diff = diffDeliverables(parseResult.deliverables, existingDeliverables);
    }

    // Generate clarifying questions if requested
    let questions = null;
    if (generateQuestions) {
      questions = await generateClarifyingQuestions(text, parseResult.deliverables);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...parseResult,
        diff,
        questions,
      },
    });
  } catch (error) {
    console.error("Error parsing requirements:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to parse requirements" } },
      { status: 500 }
    );
  }
}
