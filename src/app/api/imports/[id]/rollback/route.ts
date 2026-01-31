/**
 * Import Rollback API
 *
 * POST /api/imports/[id]/rollback - Rollback an import
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { rollbackImport } from "@/lib/services/imports";

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
      select: { id: true, orgId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins can rollback
    if (!["ADMIN", "SUPER_ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const result = await rollbackImport(id, dbUser.orgId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors[0] || "Rollback failed", details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      rolledBackCount: result.rolledBackCount,
      message: `Successfully rolled back ${result.rolledBackCount} records`,
    });
  } catch (error) {
    console.error("Error rolling back import:", error);
    const message = error instanceof Error ? error.message : "Failed to rollback import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
