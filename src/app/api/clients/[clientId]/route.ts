import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { getClientById, updateClient, softDeleteClient } from "@/lib/services/clients";
import { checkAccess, canEditClient } from "@/lib/services/client-sharing";
import { ClientStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";
import { checkScopedPermission } from "@/lib/rbac";

// Validation schema for updating a client
const updateClientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().nullable().optional(),
  address: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      formatted: z.string().optional(),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  additionalPhones: z
    .array(
      z.object({
        number: z.string(),
        label: z.string(),
      })
    )
    .nullable()
    .optional(),
  internalId: z.string().max(100).nullable().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  assignedTo: z.string().uuid().optional(),
});

/**
 * GET /api/clients/:clientId - Get a client by ID
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { clientId } = await context.params;

      const client = await getClientById(clientId, user.orgId);

      if (!client) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404 }
        );
      }

      // Check access: assigned user, admins, or through sharing
      if (user.role === UserRole.CASE_MANAGER || user.role === UserRole.VIEWER) {
        const access = await checkAccess(clientId, user.id, user.orgId);
        if (!access.hasAccess) {
          return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "You do not have permission to view this client" } },
            { status: 403 }
          );
        }

        // Include share info in response if accessing via share
        if (!access.isOwner) {
          return NextResponse.json({
            success: true,
            data: client,
            shareInfo: {
              permission: access.permission,
              expiresAt: access.expiresAt,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: client,
      });
    } catch (error) {
      console.error("Error fetching client:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch client" } },
        { status: 500 }
      );
    }
  },
  { action: "VIEW", resource: "CLIENT" }
);

interface ClientRouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * PATCH /api/clients/:clientId - Update a client
 */
export async function PATCH(request: NextRequest, context: ClientRouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // RBAC: Check update permission with client scope
    const permissionCheck = await checkScopedPermission(user, "clients", "update", {
      clientId,
    });
    if (!permissionCheck.allowed) {
      return permissionCheck.response;
    }

    // Check client exists and user has access
    const existingClient = await getClientById(clientId, user.orgId);

    if (!existingClient) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Case managers: additional check for EDIT/FULL share permission
    if (user.role === UserRole.CASE_MANAGER) {
      const canEdit = await canEditClient(clientId, user.id, user.orgId);
      if (!canEdit) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "You do not have permission to update this client" } },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validation = updateClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid client data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Only admins and program managers can reassign clients
    if (
      validation.data.assignedTo &&
      validation.data.assignedTo !== existingClient.assignedTo &&
      user.role === UserRole.CASE_MANAGER
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to reassign clients" } },
        { status: 403 }
      );
    }

    const updatedClient = await updateClient(clientId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      data: updatedClient,
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update client" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:clientId - Soft delete a client
 */
export async function DELETE(request: NextRequest, context: ClientRouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // RBAC: Check delete permission
    const permissionCheck = await checkScopedPermission(user, "clients", "delete", {
      clientId,
    });
    if (!permissionCheck.allowed) {
      return permissionCheck.response;
    }

    const existingClient = await getClientById(clientId, user.orgId);

    if (!existingClient) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    await softDeleteClient(clientId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete client" } },
      { status: 500 }
    );
  }
}
