import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getClientById } from "@/lib/services/clients";
import {
  revokeShare,
  getShareById,
  updateShare,
} from "@/lib/services/client-sharing";
import { ClientSharePermission } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a share
const updateShareSchema = z.object({
  permission: z.nativeEnum(ClientSharePermission).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string; shareId: string }>;
}

/**
 * GET /api/clients/:clientId/shares/:shareId - Get a specific share
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, shareId } = await context.params;

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Only the assigned case manager, program managers, or admins can view shares
    const canViewShare =
      client.assignedTo === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canViewShare) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view this share",
          },
        },
        { status: 403 }
      );
    }

    const share = await getShareById(shareId, user.orgId);

    if (!share || share.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Share not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error) {
    console.error("Error fetching share:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch share" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/:clientId/shares/:shareId - Update a share
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, shareId } = await context.params;

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Only the assigned case manager, program managers, or admins can update shares
    const canUpdateShare =
      client.assignedTo === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canUpdateShare) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to update this share",
          },
        },
        { status: 403 }
      );
    }

    // Verify share exists and belongs to this client
    const existingShare = await getShareById(shareId, user.orgId);

    if (!existingShare || existingShare.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Share not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateShareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid update data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const updates: {
      permission?: ClientSharePermission;
      expiresAt?: Date | null;
      notes?: string | null;
    } = {};

    if (validation.data.permission !== undefined) {
      updates.permission = validation.data.permission;
    }
    if (validation.data.expiresAt !== undefined) {
      updates.expiresAt = validation.data.expiresAt
        ? new Date(validation.data.expiresAt)
        : null;
    }
    if (validation.data.notes !== undefined) {
      updates.notes = validation.data.notes;
    }

    const updatedShare = await updateShare(shareId, user.orgId, user.id, updates);

    return NextResponse.json({
      success: true,
      data: updatedShare,
    });
  } catch (error) {
    console.error("Error updating share:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update share" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:clientId/shares/:shareId - Revoke a share
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, shareId } = await context.params;

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);

    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Only the assigned case manager, program managers, or admins can revoke shares
    const canRevokeShare =
      client.assignedTo === user.id ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.PROGRAM_MANAGER;

    if (!canRevokeShare) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to revoke this share",
          },
        },
        { status: 403 }
      );
    }

    // Verify share exists and belongs to this client
    const existingShare = await getShareById(shareId, user.orgId);

    if (!existingShare || existingShare.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Share not found" } },
        { status: 404 }
      );
    }

    await revokeShare(shareId, user.id, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Share revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking share:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("already revoked")) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: error.message } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to revoke share" } },
      { status: 500 }
    );
  }
}
