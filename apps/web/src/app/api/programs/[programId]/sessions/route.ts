import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getProgramById,
  createSession,
  listSessions,
  bulkCreateSessions,
} from "@/lib/services/programs";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a session
const createSessionSchema = z.object({
  sessionNumber: z.number().int().min(1),
  title: z.string().min(1, "Title is required").max(200),
  topic: z.string().max(2000).nullable().optional(),
  date: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

// Validation schema for bulk creating sessions
const bulkCreateSessionsSchema = z.object({
  sessions: z.array(
    z.object({
      title: z.string().min(1).max(200),
      topic: z.string().max(2000).nullable().optional(),
      date: z.string().datetime().nullable().optional().transform((val) => val ? new Date(val) : null),
      durationMinutes: z.number().int().min(1).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    })
  ).min(1),
});

type RouteParams = {
  params: Promise<{ programId: string }>;
};

/**
 * GET /api/programs/[programId]/sessions - List sessions for a program
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Verify program exists and belongs to org
    const program = await getProgramById(programId, user.orgId);
    if (!program) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Program not found" } },
        { status: 404 }
      );
    }

    const sessions = await listSessions(programId);

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error("Error listing sessions:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list sessions" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programs/[programId]/sessions - Create session(s)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth();
    const { programId } = await params;

    // Only admins and program managers can create sessions
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.PROGRAM_MANAGER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create sessions" } },
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

    const body = await request.json();

    // Check if bulk create
    if (body.sessions && Array.isArray(body.sessions)) {
      const validation = bulkCreateSessionsSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid sessions data",
              details: validation.error.flatten(),
            },
          },
          { status: 400 }
        );
      }

      const sessions = await bulkCreateSessions(programId, validation.data.sessions);

      return NextResponse.json(
        { success: true, data: sessions },
        { status: 201 }
      );
    }

    // Single session create
    const validation = createSessionSchema.safeParse(body);

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

    const session = await createSession({
      programId,
      sessionNumber: validation.data.sessionNumber,
      title: validation.data.title,
      topic: validation.data.topic,
      date: validation.data.date,
      durationMinutes: validation.data.durationMinutes,
      notes: validation.data.notes,
    });

    return NextResponse.json(
      { success: true, data: session },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create session" } },
      { status: 500 }
    );
  }
}
