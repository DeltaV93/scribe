import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { DetectedField } from "@/lib/services/form-conversion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for field updates
const updateFieldSchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  purpose: z.string().optional(),
  isRequired: z.boolean().optional(),
  isSensitive: z.boolean().optional(),
  section: z.string().optional().nullable(),
  helpText: z.string().optional().nullable(),
  options: z.array(z.string()).optional(),
  remove: z.boolean().optional(),
});

const reviewSchema = z.object({
  fields: z.array(updateFieldSchema),
  suggestedFormName: z.string().optional(),
  suggestedFormType: z.string().optional(),
});

/**
 * POST /api/form-conversion/[id]/review - Submit reviewed field edits
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Get conversion
    const conversion = await prisma.formConversion.findUnique({
      where: { id },
    });

    if (!conversion) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversion not found" } },
        { status: 404 }
      );
    }

    if (conversion.orgId !== user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    if (conversion.status !== "REVIEW_REQUIRED") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Cannot review conversion with status: ${conversion.status}`,
          },
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = reviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid review data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { fields: fieldUpdates, suggestedFormName, suggestedFormType } = validation.data;

    // Get current detected fields
    const currentFields = (conversion.detectedFields || []) as unknown as DetectedField[];

    // Apply updates
    const updatedFields: DetectedField[] = [];

    for (const currentField of currentFields) {
      const update = fieldUpdates.find((u) => u.slug === currentField.slug);

      if (update?.remove) {
        // Skip this field (remove it)
        continue;
      }

      if (update) {
        // Apply updates
        updatedFields.push({
          ...currentField,
          name: update.name ?? currentField.name,
          type: (update.type as DetectedField["type"]) ?? currentField.type,
          purpose: (update.purpose as DetectedField["purpose"]) ?? currentField.purpose,
          isRequired: update.isRequired ?? currentField.isRequired,
          isSensitive: update.isSensitive ?? currentField.isSensitive,
          section: update.section !== undefined ? (update.section ?? undefined) : currentField.section,
          helpText: update.helpText !== undefined ? (update.helpText ?? undefined) : currentField.helpText,
          options: update.options ?? currentField.options,
          confidence: 1.0, // User verified
        });
      } else {
        updatedFields.push(currentField);
      }
    }

    // Add any new fields from the updates
    for (const update of fieldUpdates) {
      if (!currentFields.some((f) => f.slug === update.slug) && !update.remove) {
        updatedFields.push({
          slug: update.slug,
          name: update.name || update.slug,
          type: (update.type as DetectedField["type"]) || "TEXT_SHORT",
          purpose: (update.purpose as DetectedField["purpose"]) || "OTHER",
          isRequired: update.isRequired ?? false,
          isSensitive: update.isSensitive ?? false,
          section: update.section ?? undefined,
          helpText: update.helpText ?? undefined,
          options: update.options,
          order: updatedFields.length,
          confidence: 1.0,
          sourceLabel: update.name || update.slug,
        });
      }
    }

    // Update conversion with reviewed fields
    await prisma.formConversion.update({
      where: { id },
      data: {
        detectedFields: updatedFields as unknown as Prisma.InputJsonValue,
        confidence: 1.0, // User reviewed
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        fieldCount: updatedFields.length,
        suggestedFormName,
        suggestedFormType,
      },
      message: "Review saved. Ready to create form.",
    });
  } catch (error) {
    console.error("Error reviewing conversion:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save review" } },
      { status: 500 }
    );
  }
}
