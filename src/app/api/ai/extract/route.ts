import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractFormData } from "@/lib/ai/extraction";
import { getExamplesForFields } from "@/lib/ai/examples";
import type { ExtractableField } from "@/lib/ai/types";

// Request validation schema
const extractRequestSchema = z.object({
  formId: z.string().uuid(),
  sourceText: z.string().min(1).max(100000),
  documentType: z.enum(["transcript", "pdf", "email", "notes"]).optional(),
  options: z
    .object({
      includeExamples: z.boolean().optional(),
      strictMode: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = extractRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { formId, sourceText, options } = validation.data;

    // Get the form and verify access
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        orgId: user.orgId,
      },
      include: {
        fields: {
          where: {
            isAiExtractable: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.fields.length === 0) {
      return NextResponse.json(
        { error: "No AI-extractable fields in this form" },
        { status: 400 }
      );
    }

    // Convert to ExtractableField format
    const extractableFields: ExtractableField[] = form.fields.map((field) => ({
      id: field.id,
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose,
      helpText: field.helpText,
      isRequired: field.isRequired,
      options: field.options as { value: string; label: string }[] | null,
    }));

    // Get examples for few-shot learning
    let examples;
    if (options?.includeExamples !== false) {
      examples = await getExamplesForFields(
        extractableFields.map((f) => f.id)
      );
    }

    // Perform extraction
    const result = await extractFormData(
      extractableFields,
      sourceText,
      examples,
      {
        includeExamples: options?.includeExamples,
        strictMode: options?.strictMode,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Extraction API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
