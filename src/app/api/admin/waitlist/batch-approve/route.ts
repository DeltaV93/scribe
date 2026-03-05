import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { batchApproveWaitlist } from "@/lib/services/waitlist";
import { z } from "zod";

const batchApproveSchema = z.object({
  count: z.number().int().min(1).max(100),
});

/**
 * POST /api/admin/waitlist/batch-approve
 * Batch approve next N pending entries in FIFO order
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, role: true },
    });

    if (!dbUser || !["SUPER_ADMIN", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const parsed = batchApproveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Batch approve
    const approved = await batchApproveWaitlist(parsed.data.count, dbUser.id);

    return NextResponse.json({
      success: true,
      approvedCount: approved.length,
      entries: approved,
    });
  } catch (error) {
    console.error("Error batch approving waitlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
