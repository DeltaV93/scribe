import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createCredential,
  listClientCredentials,
} from "@/lib/services/credentials";
import { prisma } from "@/lib/db";
import { CredentialStatus } from "@prisma/client";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for creating a credential
const createCredentialSchema = z.object({
  name: z.string().min(1).max(255),
  issuingOrg: z.string().max(255).optional().nullable(),
  issueDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  expiryDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  documentUrl: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/clients/:clientId/credentials - List credentials for a client
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;
    const { searchParams } = new URL(request.url);

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    // Parse query parameters
    const status = searchParams.get("status") as CredentialStatus | null;
    const expiringWithinDays = searchParams.get("expiringWithinDays");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const result = await listClientCredentials(
      clientId,
      user.orgId,
      {
        status: status ?? undefined,
        expiringWithinDays: expiringWithinDays ? parseInt(expiringWithinDays, 10) : undefined,
        search: search ?? undefined,
      },
      { page, limit }
    );

    return NextResponse.json({
      success: true,
      data: result.credentials,
      pagination: {
        page,
        limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error listing credentials:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list credentials" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/:clientId/credentials - Create a new credential
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { clientId } = await context.params;

    // Viewers cannot create credentials
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to create credentials" } },
        { status: 403 }
      );
    }

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCredentialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid credential data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const credential = await createCredential(user.orgId, {
      clientId,
      ...validation.data,
    });

    return NextResponse.json(
      {
        success: true,
        data: credential,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating credential:", error);
    if (error instanceof Error && error.message === "Client not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create credential" } },
      { status: 500 }
    );
  }
}
