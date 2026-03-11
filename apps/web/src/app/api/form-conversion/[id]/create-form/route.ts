import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { createFormFromConversion, getConversionStatus } from "@/lib/services/form-conversion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for form creation
const createFormSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(["INTAKE", "FOLLOWUP", "REFERRAL", "ASSESSMENT", "CUSTOM"]).default("CUSTOM"),
  selectedFields: z.array(z.string()).optional(),
});

/**
 * POST /api/form-conversion/[id]/create-form - Create a form from conversion
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Check permissions
    if (!user.permissions.canCreateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create forms" } },
        { status: 403 }
      );
    }

    // Get conversion status
    const conversion = await getConversionStatus(id);

    if (!conversion) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversion not found" } },
        { status: 404 }
      );
    }

    if (conversion.status !== "REVIEW_REQUIRED" && conversion.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Cannot create form from conversion with status: ${conversion.status}`,
          },
        },
        { status: 400 }
      );
    }

    if (conversion.resultForm) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_EXISTS",
            message: "A form has already been created from this conversion",
          },
          data: { formId: conversion.resultForm.id },
        },
        { status: 409 }
      );
    }

    const body = await request.json();
    const validation = createFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid form data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const formId = await createFormFromConversion(id, user.id, {
      name: validation.data.name,
      description: validation.data.description,
      type: validation.data.type,
      selectedFields: validation.data.selectedFields,
    });

    return NextResponse.json(
      {
        success: true,
        data: { formId },
        message: "Form created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating form from conversion:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create form" } },
      { status: 500 }
    );
  }
}
