import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

/**
 * GET /api/templates/:templateId
 *
 * Get a single template with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch template" } },
      { status: 500 }
    );
  }
}

// Schema for updating a template
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().url().optional().nullable(),
  useCaseExamples: z.array(z.string()).optional(),
});

/**
 * PATCH /api/templates/:templateId
 *
 * Update a template's metadata
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

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

    // Find the template
    const template = await prisma.formTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { orgId: user.orgId },
          // Only admins can update system templates
          ...(["SUPER_ADMIN", "ADMIN"].includes(user.role)
            ? [{ isSystemTemplate: true }]
            : []),
        ],
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found or not editable" } },
        { status: 404 }
      );
    }

    // Update the template
    const updated = await prisma.formTemplate.update({
      where: { id: templateId },
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update template" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:templateId
 *
 * Delete a template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Find the template
    const template = await prisma.formTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { orgId: user.orgId },
          // Only admins can delete system templates
          ...(["SUPER_ADMIN", "ADMIN"].includes(user.role)
            ? [{ isSystemTemplate: true }]
            : []),
        ],
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Template not found or not deletable" } },
        { status: 404 }
      );
    }

    // Delete the template
    await prisma.formTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      data: { id: templateId },
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete template" } },
      { status: 500 }
    );
  }
}
