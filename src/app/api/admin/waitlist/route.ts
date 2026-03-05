import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { listWaitlist, isInternalAdmin } from "@/lib/services/waitlist";
import { WaitlistStatus } from "@prisma/client";

/**
 * GET /api/admin/waitlist
 * List waitlist entries with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
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
      select: { email: true },
    });

    if (!dbUser || !isInternalAdmin(dbUser.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as WaitlistStatus | null;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 250);

    // List entries
    const result = await listWaitlist({
      status: status || undefined,
      search,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing waitlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
