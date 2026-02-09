/**
 * Client Insurance API Routes
 *
 * Endpoints for managing client insurance information.
 *
 * POST /api/clients/:clientId/insurance - Save insurance info
 * GET /api/clients/:clientId/insurance - Get insurance info
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  saveClientInsurance,
  getClientInsurance,
} from "@/lib/services/eligibility";
import { getClientById } from "@/lib/services/clients";
import { checkAccess } from "@/lib/services/client-sharing";
import { UserRole } from "@/types";

// Validation schema for creating/updating insurance
const insuranceSchema = z.object({
  planName: z.string().min(1, "Plan name is required").max(200),
  memberId: z.string().min(1, "Member ID is required").max(100),
  groupNumber: z.string().max(100).nullable().optional(),
  payerCode: z.string().max(50).nullable().optional(),
  payerName: z.string().max(200).nullable().optional(),
  effectiveDate: z.string().transform((val) => new Date(val)),
  terminationDate: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  isPrimary: z.boolean().optional().default(true),
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
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/insurance
 *
 * Get all insurance records for a client.
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

    const insurances = await getClientInsurance(clientId);

    return NextResponse.json({
      success: true,
      data: insurances,
    });
  } catch (error) {
    console.error("Error fetching client insurance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch insurance" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/:clientId/insurance
 *
 * Add a new insurance record for a client.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot add insurance
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to add insurance",
          },
        },
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

    // Check access permissions for case managers
    if (user.role === UserRole.CASE_MANAGER) {
      const access = await checkAccess(clientId, user.id, user.orgId);
      if (!access.hasAccess || access.permission === "VIEW") {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = insuranceSchema.safeParse(body);

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

    const insurance = await saveClientInsurance({
      clientId,
      ...validation.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: insurance,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error saving client insurance:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save insurance" } },
      { status: 500 }
    );
  }
}
