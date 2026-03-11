import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getProgramById,
  getSessionById,
  updateSession,
  deleteSession,
} from "@/lib/services/programs";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a session
const updateSessionSchema = z.object({
  sessionNumber: z.number().int().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  topic: z.string().max(2000).nullable().optional(),
  date: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

type RouteParams = {
  params: Promise<{ programId: string; sessionId: string }>;
};

/**
 * GET /api/programs/[programId]/sessions/[sessionId] - Get a session
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const session = await getSessionById(sessionId, programId);
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get session" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/programs/[programId]/sessions/[sessionId] - Update a session
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins and program managers can update sessions
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update sessions" } },
        { status: 403 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify session exists
    const existing = await getSessionById(sessionId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateSessionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid session data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const session = await updateSession(sessionId, programId, validation.data);

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update session" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programs/[programId]/sessions/[sessionId] - Delete a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId, sessionId } = await params;

    // Only admins and program managers can delete sessions
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to delete sessions" } },
        { status: 403 }
      );
    }

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    // Verify session exists
    const existing = await getSessionById(sessionId, programId);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 }
      );
    }

    await deleteSession(sessionId, programId);

    return NextResponse.json({ success: true, message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete session" } },
      { status: 500 }
    );
  }
}
