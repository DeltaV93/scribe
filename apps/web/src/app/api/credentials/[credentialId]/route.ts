import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getCredential,
  updateCredential,
  deleteCredential,
} from "@/lib/services/credentials";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";
import { z } from "zod";

// Validation schema for updating a credential
const updateCredentialSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  issuingOrg: z.string().max(255).optional().nullable(),
  issueDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  expiryDate: z.string().optional().nullable().transform((val) => (val ? new Date(val) : null)),
  documentUrl: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

interface RouteContext {
  params: Promise<{ credentialId: string }>;
}

/**
 * GET /api/credentials/:credentialId - Get a credential by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { credentialId } = await context.params;

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

    const credential = await getCredential(credentialId, user.orgId);

    if (!credential) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Credential not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: credential,
    });
  } catch (error) {
    console.error("Error fetching credential:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch credential" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/credentials/:credentialId - Update a credential
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { credentialId } = await context.params;

    // Viewers cannot update credentials
    if (user.role === UserRole.VIEWER) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not have permission to update credentials" } },
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
    const validation = updateCredentialSchema.safeParse(body);

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

    const credential = await updateCredential(credentialId, user.orgId, validation.data);

    return NextResponse.json({
      success: true,
      data: credential,
    });
  } catch (error) {
    console.error("Error updating credential:", error);
    if (error instanceof Error && error.message === "Credential not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Credential not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update credential" } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credentials/:credentialId - Delete a credential
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { credentialId } = await context.params;

    // Only admins can delete credentials
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only administrators can delete credentials" } },
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

    await deleteCredential(credentialId, user.orgId);

    return NextResponse.json({
      success: true,
      message: "Credential deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting credential:", error);
    if (error instanceof Error && error.message === "Credential not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Credential not found" } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete credential" } },
      { status: 500 }
    );
  }
}
