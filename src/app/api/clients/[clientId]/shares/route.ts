import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById } from "@/lib/services/clients";
import {
  shareClient,
  getClientShares,
} from "@/lib/services/client-sharing";
import { ClientSharePermission } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a share
const createShareSchema = z.object({
  sharedWithUserId: z.string().uuid("Invalid user ID"),
  permission: z.nativeEnum(ClientSharePermission),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * POST /api/clients/:clientId/shares - Share a client with another user
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Only the assigned case manager, program managers, or admins can share
    const canShare =
      client.assignedTo === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canShare) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to share this client",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid share data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sharedWithUserId, permission, expiresAt, notes } = validation.data;

    const share = await shareClient(
      clientId,
      sharedWithUserId,
      permission,
      user.id,
      user.orgId,
      {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes ?? null,
      }
    );

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error) {
    console.error("Error sharing client:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("inactive")
      ) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (
        error.message.includes("Cannot share") ||
        error.message.includes("already assigned")
      ) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to share client" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/clients/:clientId/shares - List all shares for a client
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

    // Only the assigned case manager, program managers, or admins can view shares
    const canViewShares =
      client.assignedTo === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canViewShares) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view shares for this client",
          },
        },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const includeRevoked = searchParams.get("includeRevoked") === "true";

    const shares = await getClientShares(clientId, user.orgId, includeRevoked);

    return NextResponse.json({
      success: true,
      data: shares,
    });
  } catch (error) {
    console.error("Error fetching client shares:", error);
    return NextResponse.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch client shares" },
      },
      { status: 500 }
    );
  }
}
