/**
 * Client Insurance ID API Routes
 *
 * Endpoints for managing a specific client insurance record.
 *
 * GET /api/clients/:clientId/insurance/:insuranceId - Get insurance by ID
 * PATCH /api/clients/:clientId/insurance/:insuranceId - Update insurance
 * DELETE /api/clients/:clientId/insurance/:insuranceId - Delete insurance
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  getClientInsuranceById,
  updateClientInsurance,
  deleteClientInsurance,
} from "@/lib/services/eligibility";
import { getClientById } from "@/lib/services/clients";
import { checkAccess, canEditClient } from "@/lib/services/client-sharing";
import { UserRole } from "@/types";

// Validation schema for updating insurance
const updateInsuranceSchema = z.object({
  planName: z.string().min(1).max(200).optional(),
  memberId: z.string().min(1).max(100).optional(),
  groupNumber: z.string().max(100).nullable().optional(),
  payerCode: z.string().max(50).nullable().optional(),
  payerName: z.string().max(200).nullable().optional(),
  effectiveDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  terminationDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  isPrimary: z.boolean().optional(),
  subscriberName: z.string().max(200).nullable().optional(),
  subscriberDob: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  subscriberRelation: z
    .enum(["self", "spouse", "child", "other"])
    .nullable()
    .optional(),
  planType: z.string().max(50).nullable().optional(),
  planPhone: z.string().max(20).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string; insuranceId: string }>;
}

/**
 * GET /api/clients/:clientId/insurance/:insuranceId
 *
 * Get a specific insurance record.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, insuranceId } = await context.params;

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Check access permissions
    if (user.role === UserRole.CASE_MANAGER || user.role === UserRole.VIEWER) {
      const access = await checkAccess(clientId, user.id, user.orgId);
      if (!access.hasAccess) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to view this client",
            },
          },
          { status: 403 }
        );
      }
    }

    const insurance = await getClientInsuranceById(insuranceId);

    if (!insurance || insurance.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Insurance not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: insurance,
    });
  } catch (error) {
    console.error("Error fetching insurance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch insurance" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/:clientId/insurance/:insuranceId
 *
 * Update a specific insurance record.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, insuranceId } = await context.params;

    // Viewers cannot update insurance
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to update insurance",
          },
        },
        { status: 403 }
      );
    }

    // Check client exists
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Check access for case managers
    if (user.role === UserRole.CASE_MANAGER) {
      const canEdit = await canEditClient(clientId, user.id, user.orgId);
      if (!canEdit) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to modify this client",
            },
          },
          { status: 403 }
        );
      }
    }

    // Check insurance exists and belongs to client
    const existingInsurance = await getClientInsuranceById(insuranceId);
    if (!existingInsurance || existingInsurance.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Insurance not found" } },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateInsuranceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid insurance data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const insurance = await updateClientInsurance(insuranceId, validation.data);

    return NextResponse.json({
      success: true,
      data: insurance,
    });
  } catch (error) {
    console.error("Error updating insurance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update insurance" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/:clientId/insurance/:insuranceId
 *
 * Delete a specific insurance record.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, insuranceId } = await context.params;

    // Only admins and program managers can delete insurance
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.PROGRAM_MANAGER
    ) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to delete insurance records",
          },
        },
        { status: 403 }
      );
    }

    // Check client exists
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Check insurance exists and belongs to client
    const existingInsurance = await getClientInsuranceById(insuranceId);
    if (!existingInsurance || existingInsurance.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Insurance not found" } },
        { status: 404 }
      );
    }

    await deleteClientInsurance(insuranceId);

    return NextResponse.json({
      success: true,
      message: "Insurance deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting insurance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete insurance" } },
      { status: 500 }
    );
  }
}
