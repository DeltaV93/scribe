import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientMatchPreference, upsertClientMatchPreference } from "@/lib/services/client-matching";
import { getClientById } from "@/lib/services/clients";
import { UserRole } from "@/types";
import { z } from "zod";

const updatePreferencesSchema = z.object({
  preferredLanguages: z.array(z.string().min(1).max(100)).max(20).optional(),
  requiredSkills: z.array(z.string().min(1).max(100)).max(50).optional(),
  specialNeeds: z.array(z.string().min(1).max(100)).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/match-preferences
 * Get match preferences for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Verify client exists and user has access
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view their assigned clients
    if (user.role === UserRole.CASE_MANAGER && client.assignedTo !== user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to view this client" } },
        { status: 403 }
      );
    }

    const preferences = await getClientMatchPreference(clientId, user.orgId);

    return NextResponse.json({
      success: true,
      data: preferences || {
        clientId,
        preferredLanguages: [],
        requiredSkills: [],
        specialNeeds: [],
        notes: null,
      },
    });
  } catch (error) {
    console.error("Error getting client match preferences:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get match preferences" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/:clientId/match-preferences
 * Update match preferences for a client
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Only admins and program managers can update match preferences
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update match preferences" } },
        { status: 403 }
      );
    }

    // Verify client exists
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updatePreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid preferences data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const preferences = await upsertClientMatchPreference(clientId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      message: "Match preferences updated successfully",
      data: preferences,
    });
  } catch (error) {
    console.error("Error updating client match preferences:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update match preferences" } },
      { status: 500 }
    );
  }
}
