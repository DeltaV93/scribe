import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { renewCredential } from "@/lib/services/credentials";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for renewing a credential
const renewCredentialSchema = z.object({
  newExpiryDate: z.string().transform((val) => new Date(val)),
  newIssueDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  newDocumentUrl: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ credentialId: string }>;
}

/**
 * POST /api/credentials/:credentialId/renew - Renew a credential with a new expiry date
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { credentialId } = await context.params;

    // Viewers cannot renew credentials
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to renew credentials" } },
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
    const validation = renewCredentialSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid renewal data",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const credential = await renewCredential(credentialId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      data: credential,
    });
  } catch (error) {
    console.error("Error renewing credential:", error);
    if (error instanceof Error && error.message === "Credential not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Credential not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to renew credential" } },
      { status: 500 }
    );
  }
}
