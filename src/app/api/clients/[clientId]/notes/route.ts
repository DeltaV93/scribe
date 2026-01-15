import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById, getClientNotes } from "@/lib/services/clients";
import { prisma } from "@/lib/db";
import { NoteType } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a note
const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required").max(10000),
  type: z.nativeEnum(NoteType).optional().default(NoteType.INTERNAL),
  callId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/notes - Get notes for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view their own assigned clients
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this client's notes" } },
        { status: 403 }
      );
    }

    const notes = await getClientNotes(clientId);

    return NextResponse.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    console.error("Error fetching client notes:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client notes" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/:clientId/notes - Create a note for a client
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot create notes
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create notes" } },
        { status: 403 }
      );
    }

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only add notes to their own assigned clients
    if (
      user.role === UserRole.CASE_MANAGER &&
      client.assignedTo !== user.id
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to add notes to this client" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid note data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const note = await prisma.note.create({
      data: {
        clientId,
        authorId: user.id,
        content: validation.data.content,
        type: validation.data.type,
        callId: validation.data.callId || null,
        tags: validation.data.tags,
        isDraft: validation.data.isDraft,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: note },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create note" } },
      { status: 500 }
    );
  }
}
