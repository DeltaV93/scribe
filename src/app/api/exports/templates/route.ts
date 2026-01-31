/**
 * Export Templates API
 *
 * GET /api/exports/templates - List templates
 * POST /api/exports/templates - Create template
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import {
  listTemplates,
  createTemplate,
  createFromPredefined,
  getPredefinedTemplate,
} from "@/lib/services/exports/templates";
import { ExportType, ExportTemplateStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as ExportTemplateStatus | null;
    const exportType = searchParams.get("exportType") as ExportType | null;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await listTemplates(dbUser.orgId, {
      status: status || undefined,
      exportType: exportType || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins and program managers can create templates
    if (!["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      exportType,
      sourceFormIds,
      fieldMappings,
      validationRules,
      outputFormat,
      outputConfig,
      usePredefined,
      customizations,
    } = body;

    // Validate required fields
    if (!name || !exportType || !sourceFormIds || sourceFormIds.length === 0) {
      return NextResponse.json(
        { error: "name, exportType, and sourceFormIds are required" },
        { status: 400 }
      );
    }

    // Validate export type
    const validTypes: ExportType[] = ["CAP60", "DOL_WIPS", "CALI_GRANTS", "HUD_HMIS", "CUSTOM"];
    if (!validTypes.includes(exportType)) {
      return NextResponse.json(
        { error: `Invalid exportType. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    let template;

    if (usePredefined && exportType !== "CUSTOM") {
      // Create from predefined template
      template = await createFromPredefined(
        dbUser.orgId,
        dbUser.id,
        exportType,
        sourceFormIds,
        {
          name,
          description,
          fieldMappingOverrides: customizations?.fieldMappingOverrides,
        }
      );
    } else {
      // Create custom template
      if (!fieldMappings || fieldMappings.length === 0) {
        return NextResponse.json(
          { error: "fieldMappings are required for custom templates" },
          { status: 400 }
        );
      }

      template = await createTemplate({
        orgId: dbUser.orgId,
        userId: dbUser.id,
        name,
        description,
        exportType,
        sourceFormIds,
        fieldMappings,
        validationRules,
        outputFormat,
        outputConfig,
      });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
