/**
 * Import Execute API
 *
 * POST /api/imports/execute - Execute the import
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { executeImport } from "@/lib/services/imports";
import { ImportFieldMapping, DuplicateSettings, DEFAULT_DUPLICATE_SETTINGS } from "@/lib/services/imports/types";
import { DuplicateAction } from "@prisma/client";

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
      duplicateResolutions,
    } = body as {
      batchId: string;
      fieldMappings: ImportFieldMapping[];
      duplicateSettings?: DuplicateSettings;
      duplicateResolutions?: Record<number, { action: DuplicateAction; selectedMatchId?: string }>;
    };

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    if (!fieldMappings || fieldMappings.length === 0) {
      return NextResponse.json({ error: "fieldMappings are required" }, { status: 400 });
    }

    // Verify batch belongs to org
    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, orgId: dbUser.orgId },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (!["MAPPING", "READY"].includes(batch.status)) {
      return NextResponse.json(
        { error: `Cannot execute import with status: ${batch.status}` },
        { status: 400 }
      );
    }

    const result = await executeImport({
      batchId,
      orgId: dbUser.orgId,
      userId: dbUser.id,
      fieldMappings,
      duplicateSettings: duplicateSettings || DEFAULT_DUPLICATE_SETTINGS,
      duplicateResolutions,
    });

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      jobProgressId: result.jobProgressId,
      message: "Import started. You can track progress using the job ID.",
    });
  } catch (error) {
    console.error("Error executing import:", error);
    const message = error instanceof Error ? error.message : "Failed to execute import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
