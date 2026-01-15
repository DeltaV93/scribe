import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { FieldType, FieldPurpose, FormType, Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

const createFormSchema = z.object({
  name: z.string().min(1).max(100).optional(), // Override template name
});

interface TemplateField {
  slug: string;
  name: string;
  type: string;
  purpose: string;
  purposeNote?: string | null;
  helpText?: string | null;
  isRequired: boolean;
  isSensitive: boolean;
  isAiExtractable: boolean;
  options?: unknown;
  section?: string | null;
  order: number;
  conditionalLogic?: unknown;
  translations?: unknown;
}

interface FormSnapshot {
  name: string;
  description?: string | null;
  type: string;
  settings?: unknown;
  fields: TemplateField[];
}

/**
 * POST /api/templates/:templateId/create-form
 *
 * Create a new form from a template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { templateId } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true, orgId: true, canCreateForms: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    if (!user.canCreateForms) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You don't have permission to create forms" } },
        { status: 403 }
      );
    }

    // Get the template
    const template = await prisma.formTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { isSystemTemplate: true },
          { orgId: user.orgId },
        ],
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found" } },
        { status: 404 }
      );
    }

    const snapshot = template.formSnapshot as unknown as FormSnapshot;
    const formName = parsed.data.name || snapshot.name;

    // Create the form with fields in a transaction
    const form = await prisma.$transaction(async (tx) => {
      // Create the form
      const newForm = await tx.form.create({
        data: {
          orgId: user.orgId,
          name: formName,
          description: snapshot.description,
          type: snapshot.type as FormType,
          settings: snapshot.settings || {},
          createdById: user.id,
        },
      });

      // Create fields
      if (snapshot.fields && snapshot.fields.length > 0) {
        await tx.formField.createMany({
          data: snapshot.fields.map((field: TemplateField) => ({
            formId: newForm.id,
            slug: field.slug,
            name: field.name,
            type: field.type as FieldType,
            purpose: field.purpose as FieldPurpose,
            purposeNote: field.purposeNote ?? null,
            helpText: field.helpText ?? null,
            isRequired: field.isRequired,
            isSensitive: field.isSensitive,
            isAiExtractable: field.isAiExtractable,
            options: field.options as Prisma.InputJsonValue | undefined,
            section: field.section ?? null,
            order: field.order,
            conditionalLogic: field.conditionalLogic as Prisma.InputJsonValue | undefined,
            translations: field.translations as Prisma.InputJsonValue | undefined,
          })),
        });
      }

      // Increment template usage count
      await tx.formTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });

      return newForm;
    });

    // Fetch the created form with fields
    const createdForm = await prisma.form.findUnique({
      where: { id: form.id },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: createdForm,
    });
  } catch (error) {
    console.error("Error creating form from template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create form from template" } },
      { status: 500 }
    );
  }
}
