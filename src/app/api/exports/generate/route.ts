/**
 * Export Generation API
 *
 * POST /api/exports/generate - Generate an export
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { generateExport } from "@/lib/services/exports";

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

    const body = await request.json();
    const {
      templateId,
      periodStart,
      periodEnd,
      programIds,
      clientIds,
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

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "periodStart must be before periodEnd" },
        { status: 400 }
      );
    }

    const result = await generateExport({
      templateId,
      orgId: dbUser.orgId,
      userId: dbUser.id,
      periodStart: startDate,
      periodEnd: endDate,
      programIds,
      clientIds,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("Error generating export:", error);
    const message = error instanceof Error ? error.message : "Failed to generate export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
