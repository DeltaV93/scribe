import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import {
  acquireLock,
  releaseLock,
  checkLock,
  type LockableResourceType,
} from "@/lib/services/resource-locking";
import { z } from "zod";

const acquireLockSchema = z.object({
  resourceType: z.enum(["form_submission", "client", "form", "call"]),
  resourceId: z.string().uuid(),
  expirationMs: z.number().int().min(30000).max(1800000).optional(),
});

const releaseLockSchema = z.object({
  resourceType: z.enum(["form_submission", "client", "form", "call"]),
  resourceId: z.string().uuid(),
});

/**
 * GET /api/locks
 *
 * Check lock status for a resource
 *
 * Query params:
 * - resourceType: string
 * - resourceId: string
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get("resourceType");
    const resourceId = searchParams.get("resourceId");

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "resourceType and resourceId are required" } },
        { status: 400 }
      );
    }

    const result = await checkLock(
      resourceType as LockableResourceType,
      resourceId
    );

    // Get current user ID to check if they own the lock
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        locked: result.locked,
        isOwnLock: result.lock?.lockedBy === user?.id,
        lockedBy: result.userName,
        expiresAt: result.lock?.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error checking lock:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to check lock" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locks
 *
 * Acquire a lock on a resource
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = acquireLockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { resourceType, resourceId, expirationMs } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const result = await acquireLock(
      resourceType as LockableResourceType,
      resourceId,
      user.id,
      expirationMs
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "LOCK_FAILED", message: result.error },
          data: {
            existingLock: result.existingLock,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        lockId: result.lock?.id,
        expiresAt: result.lock?.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error acquiring lock:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to acquire lock" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/locks
 *
 * Release a lock on a resource
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = releaseLockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const { resourceType, resourceId } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: session.user.id },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const result = await releaseLock(
      resourceType as LockableResourceType,
      resourceId,
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "RELEASE_FAILED", message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error releasing lock:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to release lock" } },
      { status: 500 }
    );
  }
}
