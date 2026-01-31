/**
 * Export Download API
 *
 * GET /api/exports/[id]/download - Get signed download URL
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getExportDownloadUrl } from "@/lib/services/exports/storage";

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

    // Verify export exists and belongs to org
    const exportRecord = await prisma.funderExport.findFirst({
      where: { id, orgId: dbUser.orgId },
      select: { status: true, filePath: true },
    });

    if (!exportRecord) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    if (exportRecord.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Export is not completed" },
        { status: 400 }
      );
    }

    if (!exportRecord.filePath) {
      return NextResponse.json(
        { error: "Export file not available" },
        { status: 404 }
      );
    }

    const downloadUrl = await getExportDownloadUrl(id, dbUser.orgId);

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("Error getting download URL:", error);
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}
