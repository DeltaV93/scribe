import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { createMassNoteJob, getSessionAttendeesForMassNote } from "@/lib/services/mass-notes";
import { NoteType } from "@prisma/client";

// Validation schema for creating mass notes
const createMassNotesSchema = z.object({
  sessionId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  templateContent: z.string().min(1).max(10000),
  noteType: z.nativeEnum(NoteType),
  tags: z.array(z.string()).default([]),
  clientIds: z.array(z.string().uuid()).min(1).max(500),
  customVariables: z.record(z.string()).optional(),
});

/**
 * POST /api/mass-notes - Create a mass note job
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = createMassNotesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const jobId = await createMassNoteJob({
      sessionId: validation.data.sessionId,
      orgId: user.orgId,
      authorId: user.id,
      templateId: validation.data.templateId,
      templateContent: validation.data.templateContent,
      noteType: validation.data.noteType,
      tags: validation.data.tags,
      clientIds: validation.data.clientIds,
      customVariables: validation.data.customVariables,
    });

    return NextResponse.json(
      {
        success: true,
        data: { jobId },
        message: `Mass note creation started for ${validation.data.clientIds.length} clients`,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error creating mass notes:", error);

    if (error instanceof Error) {
      if (error.message.includes("not enabled")) {
        return NextResponse.json(
          { error: { code: "FEATURE_DISABLED", message: error.message } },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create mass notes" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mass-notes - Get attendees for mass note creation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "sessionId is required" } },
        { status: 400 }
      );
    }

    const result = await getSessionAttendeesForMassNote(sessionId, user.orgId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error getting session attendees:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get session attendees" } },
      { status: 500 }
    );
  }
}
