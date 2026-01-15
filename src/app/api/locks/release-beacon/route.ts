import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { releaseLock, type LockableResourceType } from "@/lib/services/resource-locking";
import { z } from "zod";

const releaseSchema = z.object({
  resourceType: z.enum(["form_submission", "client", "form", "call"]),
  resourceId: z.string().uuid(),
});

/**
 * POST /api/locks/release-beacon
 *
 * Special endpoint for navigator.sendBeacon() to release locks on page unload.
 * This endpoint uses a simple POST instead of DELETE because sendBeacon only supports POST.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Return 200 even on auth failure for beacon requests
      return NextResponse.json({ success: false });
    }

    const body = await request.json();
    const parsed = releaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false });
    }

    const { resourceType, resourceId } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false });
    }

    await releaseLock(
      resourceType as LockableResourceType,
      resourceId,
      user.id
    );

    return NextResponse.json({ success: true });
  } catch {
    // Silently fail for beacon requests
    return NextResponse.json({ success: false });
  }
}
