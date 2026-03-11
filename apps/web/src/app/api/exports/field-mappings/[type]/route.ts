/**
 * Field Mappings API
 *
 * GET /api/exports/field-mappings/[type] - Get suggested field mappings for export type
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { ExportType } from "@prisma/client";
import {
  getPredefinedTemplate,
  getSuggestedMappings,
  getAvailableFields,
} from "@/lib/services/exports/templates";

interface RouteParams {
  params: Promise<{ type: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;
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

    // Validate export type
    const exportType = type.toUpperCase() as ExportType;
    const validTypes: ExportType[] = ["CAP60", "DOL_WIPS", "CALI_GRANTS", "HUD_HMIS", "CUSTOM"];

    if (!validTypes.includes(exportType)) {
      return NextResponse.json(
        { error: `Invalid export type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Get form IDs from query params
    const searchParams = request.nextUrl.searchParams;
    const formIds = searchParams.get("formIds")?.split(",").filter(Boolean) || [];

    // Get predefined template
    const predefined = getPredefinedTemplate(exportType);

    // Get available fields from forms
    const availableFields = await getAvailableFields(dbUser.orgId, formIds);

    // Get suggested mappings
    const suggestedMappings = getSuggestedMappings(exportType);

    return NextResponse.json({
      exportType,
      predefinedTemplate: predefined
        ? {
            name: predefined.name,
            description: predefined.description,
            outputFormat: predefined.outputFormat,
            fieldCount: predefined.fields.length,
            requiredFields: predefined.fields.filter((f) => f.required).length,
          }
        : null,
      fields: predefined?.fields || [],
      codeMappings: predefined?.codeMappings || {},
      suggestedMappings,
      availableFields,
    });
  } catch (error) {
    console.error("Error getting field mappings:", error);
    return NextResponse.json(
      { error: "Failed to get field mappings" },
      { status: 500 }
    );
  }
}
