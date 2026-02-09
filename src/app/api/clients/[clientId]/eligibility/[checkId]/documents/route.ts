/**
 * Eligibility Documents API Route
 *
 * Generates eligibility documents (PDF summary, CMS-1500 form).
 *
 * GET /api/clients/:clientId/eligibility/:checkId/documents
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import {
  getEligibilityCheckById,
  generateEligibilityPDF,
  generateCMS1500,
} from "@/lib/services/eligibility";
import { getClientById } from "@/lib/services/clients";
import { checkAccess } from "@/lib/services/client-sharing";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";

// Query params schema
const querySchema = z.object({
  type: z.enum(["summary", "cms1500", "all"]).optional().default("all"),
  providerName: z.string().optional(),
  providerNpi: z.string().optional(),
  providerTaxId: z.string().optional(),
  providerAddress: z.string().optional(),
  providerPhone: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ clientId: string; checkId: string }>;
}

/**
 * GET /api/clients/:clientId/eligibility/:checkId/documents
 *
 * Generate eligibility documents.
 *
 * Query params:
 * - type: "summary" | "cms1500" | "all" (default: "all")
 * - providerName: Provider name for CMS-1500
 * - providerNpi: Provider NPI for CMS-1500
 * - providerTaxId: Provider tax ID for CMS-1500
 * - providerAddress: Provider address for CMS-1500
 * - providerPhone: Provider phone for CMS-1500
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId, checkId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Viewers cannot generate documents
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to generate documents",
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

    // Check access permissions
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

    // Check eligibility check exists and belongs to client
    const eligibilityCheck = await getEligibilityCheckById(checkId);
    if (!eligibilityCheck || eligibilityCheck.clientId !== clientId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Eligibility check not found" } },
        { status: 404 }
      );
    }

    // Parse query params
    const params = Object.fromEntries(searchParams.entries());
    const validation = querySchema.safeParse(params);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { type, providerName, providerNpi, providerTaxId, providerAddress, providerPhone } = validation.data;
    const documents: { type: string; url: string }[] = [];

    // Map provider info to expected format
    const providerInfo = (providerName || providerNpi || providerTaxId || providerAddress || providerPhone)
      ? {
          name: providerName,
          npi: providerNpi,
          taxId: providerTaxId,
          address: providerAddress,
          phone: providerPhone,
        }
      : undefined;

    // Generate requested documents
    if (type === "summary" || type === "all") {
      const summaryUrl = await generateEligibilityPDF(checkId, user.orgId);
      documents.push({ type: "summary", url: summaryUrl });
    }

    if (type === "cms1500" || type === "all") {
      const cms1500Url = await generateCMS1500(
        checkId,
        user.orgId,
        providerInfo
      );
      documents.push({ type: "cms1500", url: cms1500Url });
    }

    return NextResponse.json({
      success: true,
      data: {
        checkId,
        documents,
      },
    });
  } catch (error) {
    console.error("Error generating documents:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate documents" } },
      { status: 500 }
    );
  }
}
