import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { generateFormFields } from "@/lib/ai/generation";
import type { GenerateFormRequest } from "@/lib/ai/generation-types";
import { createFormGenerationTimer } from "@/lib/ai/timing";

// Request validation schema
const generateFormRequestSchema = z.object({
  formName: z.string().min(1).max(200),
  formType: z.enum(["INTAKE", "FOLLOWUP", "REFERRAL", "ASSESSMENT", "CUSTOM"]),
  description: z.string().min(10).max(5000),
  dataPoints: z.string().min(10).max(5000),
  complianceRequirements: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const timer = createFormGenerationTimer();
  const requestStart = performance.now();

  try {
    // Auth check
    let stepTimer = timer.step();
    const user = await getCurrentUser();
    stepTimer.complete("auth_check", true);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user permissions - need to be able to create forms
    if (!user.permissions.canCreateForms) {
      return NextResponse.json(
        { error: "You do not have permission to create forms" },
        { status: 403 }
      );
    }

    // Parse and validate request
    stepTimer = timer.step();
    const body = await request.json();
    const validation = generateFormRequestSchema.safeParse(body);

    if (!validation.success) {
      stepTimer.complete("request_validation", false, {
        error: "Invalid request body",
      });
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    stepTimer.complete("request_validation", true, {
      form_type: validation.data.formType,
      description_length: validation.data.description.length,
      data_points_length: validation.data.dataPoints.length,
    });

    const formRequest: GenerateFormRequest = validation.data;

    // Log request metadata
    console.log(
      `[ai_form_generation] request: form_type=${formRequest.formType}, ` +
        `description_chars=${formRequest.description.length}, ` +
        `data_points_chars=${formRequest.dataPoints.length}`
    );

    // Generate form fields using AI
    const result = await generateFormFields(formRequest);

    if (!result.success) {
      const totalDuration = performance.now() - requestStart;
      console.log(
        `[ai_form_generation] api_handler_total: ${Math.round(totalDuration)}ms (FAILED)`
      );
      return NextResponse.json(
        { error: result.error || "Failed to generate form" },
        { status: 500 }
      );
    }

    // Log successful completion
    const totalDuration = performance.now() - requestStart;
    console.log(
      `[ai_form_generation] api_handler_total: ${Math.round(totalDuration)}ms ` +
        `(${result.fields.length} fields generated)`
    );

    return NextResponse.json({
      success: true,
      fields: result.fields,
      extractionSuggestions: result.extractionSuggestions,
      reasoning: result.reasoning,
    });
  } catch (error) {
    const totalDuration = performance.now() - requestStart;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("Form generation API error:", error);
    console.log(
      `[ai_form_generation] api_handler_total: ${Math.round(totalDuration)}ms ` +
        `(ERROR: ${errorMessage})`
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
