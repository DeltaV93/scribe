/**
 * Import Batch API - Single Batch
 *
 * GET /api/imports/[id] - Get batch details with records
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getImportBatch } from "@/lib/services/imports";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const batch = await getImportBatch(id, dbUser.orgId);

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Get records for this batch (limit to first 100)
    const { searchParams } = new URL(request.url);
    const includeRecords = searchParams.get("includeRecords") !== "false";
    const recordLimit = Math.min(parseInt(searchParams.get("recordLimit") || "100", 10), 500);

    let records: unknown[] = [];
    if (includeRecords) {
      records = await prisma.importRecord.findMany({
        where: { batchId: id },
        orderBy: { rowNumber: "asc" },
        take: recordLimit,
        select: {
          id: true,
          rowNumber: true,
          status: true,
          action: true,
          sourceData: true,
          mappedData: true,
          validationErrors: true,
          createdClientId: true,
          updatedClientId: true,
          processedAt: true,
        },
      });
    }

    // Check if rollback is available
    const rollbackAvailable = batch.status === "COMPLETED" &&
      batch.rollbackAvailableUntil &&
      new Date() < batch.rollbackAvailableUntil;

    return NextResponse.json({
      batch: {
        ...batch,
        rollbackAvailable,
      },
      records,
    });
  } catch (error) {
    console.error("Error getting import batch:", error);
    return NextResponse.json(
      { error: "Failed to get batch" },
      { status: 500 }
    );
  }
}
