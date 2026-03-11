import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import {
  approveWaitlistEntry,
  rejectWaitlistEntry,
  isInternalAdmin,
} from "@/lib/services/waitlist";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

/**
 * PATCH /api/admin/waitlist/:id
 * Update waitlist entry status (approve/reject)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is internal admin
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, email: true },
    });

    if (!dbUser || !isInternalAdmin(dbUser.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check entry exists
    const existing = await prisma.waitlist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    // Update status
    let entry;
    if (parsed.data.status === "APPROVED") {
      entry = await approveWaitlistEntry(id, dbUser.id);
    } else {
      entry = await rejectWaitlistEntry(id);
    }

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error("Error updating waitlist entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
