/**
 * Template Validation API
 *
 * POST /api/exports/templates/[id]/validate - Validate template configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { validateTemplateConfig, getTemplate } from "@/lib/services/exports/templates";
import { FieldMapping } from "@/lib/services/exports/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get template
    const template = await getTemplate(id, dbUser.orgId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Validate
    const result = await validateTemplateConfig(dbUser.orgId, {
      exportType: template.exportType,
      sourceFormIds: template.sourceFormIds,
      fieldMappings: template.fieldMappings as unknown as FieldMapping[],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error validating template:", error);
    return NextResponse.json(
      { error: "Failed to validate template" },
      { status: 500 }
    );
  }
}
