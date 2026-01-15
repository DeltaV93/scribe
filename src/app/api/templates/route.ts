import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/templates
 *
 * List available form templates
 * Returns both system templates and organization templates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Get user's org
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { orgId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tags = searchParams.getAll("tag");
    const systemOnly = searchParams.get("systemOnly") === "true";

    // Build query
    const whereClause: Parameters<typeof prisma.formTemplate.findMany>[0]["where"] = {
      OR: [
        { isSystemTemplate: true },
        { orgId: user.orgId },
      ],
    };

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (tags.length > 0) {
      whereClause.tags = { hasSome: tags };
    }

    if (systemOnly) {
      whereClause.isSystemTemplate = true;
      delete whereClause.OR;
    }

    const templates = await prisma.formTemplate.findMany({
      where: whereClause,
      orderBy: [
        { isSystemTemplate: "desc" },
        { usageCount: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        thumbnail: true,
        useCaseExamples: true,
        isSystemTemplate: true,
        usageCount: true,
        createdAt: true,
        formSnapshot: true,
      },
    });

    // Extract field count from snapshot for display
    const templatesWithMeta = templates.map((template) => {
      const snapshot = template.formSnapshot as { fields?: unknown[] };
      const fieldCount = Array.isArray(snapshot?.fields) ? snapshot.fields.length : 0;

      return {
        ...template,
        fieldCount,
        formSnapshot: undefined, // Don't include full snapshot in list
      };
    });

    return NextResponse.json({
      success: true,
      data: templatesWithMeta,
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" } },
      { status: 500 }
    );
  }
}

// Schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional().default([]),
  thumbnail: z.string().url().optional(),
  useCaseExamples: z.array(z.string()).optional().default([]),
  formId: z.string().uuid(), // Source form to create template from
  isSystemTemplate: z.boolean().optional().default(false),
});

/**
 * POST /api/templates
 *
 * Create a new form template from an existing form
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { name, description, tags, thumbnail, useCaseExamples, formId, isSystemTemplate } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Only admins can create system templates
    if (isSystemTemplate && !["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only admins can create system templates" } },
        { status: 403 }
      );
    }

    // Get the source form with fields
    const form = await prisma.form.findFirst({
      where: {
        id: formId,
        orgId: user.orgId,
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Form not found" } },
        { status: 404 }
      );
    }

    // Create snapshot of form structure
    const formSnapshot = {
      name: form.name,
      description: form.description,
      type: form.type,
      settings: form.settings,
      fields: form.fields.map((field) => ({
        slug: field.slug,
        name: field.name,
        type: field.type,
        purpose: field.purpose,
        purposeNote: field.purposeNote,
        helpText: field.helpText,
        isRequired: field.isRequired,
        isSensitive: field.isSensitive,
        isAiExtractable: field.isAiExtractable,
        options: field.options,
        section: field.section,
        order: field.order,
        conditionalLogic: field.conditionalLogic,
        translations: field.translations,
      })),
    };

    // Create the template
    const template = await prisma.formTemplate.create({
      data: {
        orgId: isSystemTemplate ? null : user.orgId,
        name,
        description,
        tags,
        thumbnail,
        useCaseExamples,
        formSnapshot,
        isSystemTemplate,
        createdById: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        tags: template.tags,
        isSystemTemplate: template.isSystemTemplate,
        fieldCount: form.fields.length,
      },
    });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create template" } },
      { status: 500 }
    );
  }
}
