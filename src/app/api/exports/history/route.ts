/**
 * Export History API
 *
 * GET /api/exports/history - List exports
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { listExports } from "@/lib/services/exports";
import { ExportStatus } from "@prisma/client";

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
    const templateId = searchParams.get("templateId");
    const status = searchParams.get("status") as ExportStatus | null;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await listExports(dbUser.orgId, {
      templateId: templateId || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing exports:", error);
    return NextResponse.json(
      { error: "Failed to list exports" },
      { status: 500 }
    );
  }
}
