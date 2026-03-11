/**
 * Client Eligibility API Routes
 *
 * Endpoints for checking and retrieving eligibility information.
 *
 * POST /api/clients/:clientId/eligibility - Check eligibility
 * GET /api/clients/:clientId/eligibility - Get cached/historical eligibility
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withAuthAndAudit, type RouteContext } from "@/lib/auth/with-auth-audit";
import { z } from "zod";
import {
  verifyEligibility,
  getEligibilityHistory,
  getCachedEligibility,
} from "@/lib/services/eligibility";
import { getClientById } from "@/lib/services/clients";
import { checkAccess } from "@/lib/services/client-sharing";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";

// Validation schema for eligibility check
const eligibilityCheckSchema = z.object({
  insurancePlanId: z.string().uuid().optional(),
  serviceCode: z.string().min(1, "Service code is required").max(20),
  serviceName: z.string().max(200).optional(),
  providerNpi: z.string().min(10, "Valid NPI is required").max(10),
  forceRefresh: z.boolean().optional().default(false),
});

/**
 * GET /api/clients/:clientId/eligibility
 *
 * Get eligibility history for a client.
 * Query params:
 * - serviceCode: Filter by service code
 * - limit: Number of results (default 20)
 * - offset: Pagination offset
 */
export const GET = withAuthAndAudit(
  async (request: NextRequest, context: RouteContext, user) => {
    try {
      const { clientId } = await context.params;
      const { searchParams } = new URL(request.url);

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

      // Parse query params
      const serviceCode = searchParams.get("serviceCode");
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const offset = parseInt(searchParams.get("offset") || "0", 10);

      // If serviceCode is provided, check for cached result
      if (serviceCode) {
        const cached = await getCachedEligibility(clientId, serviceCode);
        if (cached) {
          return NextResponse.json({
            success: true,
            data: cached,
            isFromCache: true,
          });
        }
      }

      // Get eligibility history
      const { checks, total } = await getEligibilityHistory(clientId, {
        limit,
        offset,
      });

      return NextResponse.json({
        success: true,
        data: checks,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + checks.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching eligibility:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to fetch eligibility" } },
        { status: 500 }
      );
    }
  },
  { action: "VIEW", resource: "CLIENT" }
);

interface EligibilityRouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * POST /api/clients/:clientId/eligibility
 *
 * Check eligibility for a service.
 */
export async function POST(request: NextRequest, context: EligibilityRouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot check eligibility
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to check eligibility",
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

    // Check client exists and user has access
    const client = await getClientById(clientId, user.orgId);
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Check access for case managers
    if (user.role === UserRole.CASE_MANAGER) {
      const access = await checkAccess(clientId, user.id, user.orgId);
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

    // Parse and validate request body
    const body = await request.json();
    const validation = eligibilityCheckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid eligibility check request",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    // Perform eligibility check
    const result = await verifyEligibility({
      clientId,
      ...validation.data,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error checking eligibility:", error);

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
      { error: { code: "INTERNAL_ERROR", message: "Failed to check eligibility" } },
      { status: 500 }
    );
  }
}
