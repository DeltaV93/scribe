import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { generateFormFields } from "@/lib/ai/generation";
import type { GenerateFormRequest } from "@/lib/ai/generation-types";

// Request validation schema
const generateFormRequestSchema = z.object({
  formName: z.string().min(1).max(200),
  formType: z.enum(["INTAKE", "FOLLOWUP", "REFERRAL", "ASSESSMENT", "CUSTOM"]),
  description: z.string().min(10).max(5000),
  dataPoints: z.string().min(10).max(5000),
  complianceRequirements: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

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

    const body = await request.json();
    const validation = generateFormRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const formRequest: GenerateFormRequest = validation.data;

    // Generate form fields using AI
    const result = await generateFormFields(formRequest);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate form" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fields: result.fields,
      extractionSuggestions: result.extractionSuggestions,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error("Form generation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
