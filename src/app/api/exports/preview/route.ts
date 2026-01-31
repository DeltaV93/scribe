/**
 * Export Preview API
 *
 * POST /api/exports/preview - Preview export data
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { generateExportPreview } from "@/lib/services/exports";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      templateId,
      periodStart,
      periodEnd,
      limit = 10,
    } = body;

    // Validate required fields
    if (!templateId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "templateId, periodStart, and periodEnd are required" },
        { status: 400 }
      );
    }

    // Parse dates
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const preview = await generateExportPreview(
      templateId,
      dbUser.orgId,
      startDate,
      endDate,
      Math.min(limit, 50) // Max 50 rows for preview
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error generating preview:", error);
    const message = error instanceof Error ? error.message : "Failed to generate preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
