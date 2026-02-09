/**
 * Eligibility Refresh API Route
 *
 * Force refresh an eligibility check.
 *
 * POST /api/eligibility/refresh/:checkId
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getEligibilityCheckById,
  verifyEligibility,
} from "@/lib/services/eligibility";
import { getClientById } from "@/lib/services/clients";
import { checkAccess } from "@/lib/services/client-sharing";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";
import { z } from "zod";

// Request body schema
const refreshSchema = z.object({
  providerNpi: z.string().min(10).max(10),
});

interface RouteContext {
  params: Promise<{ checkId: string }>;
}

/**
 * POST /api/eligibility/refresh/:checkId
 *
 * Force refresh an eligibility check, bypassing cache.
 *
 * Request body:
 * - providerNpi: NPI of the provider performing the check (required)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { checkId } = await context.params;

    // Viewers cannot refresh eligibility
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to refresh eligibility",
          },
        },
        { status: 403 }
      );
    }

    // Check if eligibility feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { eligibilityCheckEnabled: true },
    });

    if (!org?.eligibilityCheckEnabled) {
      return NextResponse.json(
        {
          error: {
            code: "FEATURE_DISABLED",
            message: "Eligibility verification is not enabled for your organization",
          },
        },
        { status: 403 }
      );
    }

    // Get existing eligibility check
    const existingCheck = await getEligibilityCheckById(checkId);
    if (!existingCheck) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Eligibility check not found" } },
        { status: 404 }
      );
    }

    // Check client exists and belongs to user's org
    const client = await getClientById(existingCheck.clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Check access permissions
    if (user.role === UserRole.CASE_MANAGER) {
      const access = await checkAccess(existingCheck.clientId, user.id, user.orgId);
      if (!access.hasAccess) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to access this client",
            },
          },
          { status: 403 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const validation = refreshSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Perform fresh eligibility check
    const result = await verifyEligibility({
      clientId: existingCheck.clientId,
      insurancePlanId: existingCheck.insurancePlanId || undefined,
      serviceCode: existingCheck.serviceCode,
      serviceName: existingCheck.serviceName || undefined,
      providerNpi: validation.data.providerNpi,
      forceRefresh: true,
    });

    return NextResponse.json({
      success: true,
      data: result,
      previousCheckId: checkId,
    });
  } catch (error) {
    console.error("Error refreshing eligibility:", error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes("No insurance on file")) {
        return NextResponse.json(
          {
            error: {
              code: "NO_INSURANCE",
              message: "No insurance on file for this client",
            },
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to refresh eligibility" } },
      { status: 500 }
    );
  }
}
