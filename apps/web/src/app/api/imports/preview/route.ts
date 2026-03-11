/**
 * Import Preview API
 *
 * POST /api/imports/preview - Generate import preview with duplicate detection
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { generateImportPreview } from "@/lib/services/imports";
import { ImportFieldMapping, DuplicateSettings, DEFAULT_DUPLICATE_SETTINGS } from "@/lib/services/imports/types";

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

    if (!["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const {
      batchId,
      fieldMappings,
      duplicateSettings,
    } = body as {
      batchId: string;
      fieldMappings: ImportFieldMapping[];
      duplicateSettings?: DuplicateSettings;
    };

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    if (!fieldMappings || fieldMappings.length === 0) {
      return NextResponse.json({ error: "fieldMappings are required" }, { status: 400 });
    }

    // Validate required mappings
    const requiredFields = ["client.firstName", "client.lastName", "client.phone"];
    const mappedTargets = new Set(fieldMappings.map((m) => m.targetField));
    const missingRequired = requiredFields.filter((f) => !mappedTargets.has(f));

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Missing required mappings: ${missingRequired.join(", ")}` },
        { status: 400 }
      );
    }

    const preview = await generateImportPreview(
      batchId,
      dbUser.orgId,
      fieldMappings,
      duplicateSettings || DEFAULT_DUPLICATE_SETTINGS
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error generating import preview:", error);
    const message = error instanceof Error ? error.message : "Failed to generate preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
