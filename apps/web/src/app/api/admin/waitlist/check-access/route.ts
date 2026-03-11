import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { isInternalAdmin } from "@/lib/services/waitlist";

/**
 * GET /api/admin/waitlist/check-access
 * Check if current user has access to waitlist management
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasAccess: false });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { email: true },
    });

    if (!dbUser) {
      return NextResponse.json({ hasAccess: false });
    }

    return NextResponse.json({ hasAccess: isInternalAdmin(dbUser.email) });
  } catch (error) {
    console.error("Error checking waitlist access:", error);
    return NextResponse.json({ hasAccess: false });
  }
}
