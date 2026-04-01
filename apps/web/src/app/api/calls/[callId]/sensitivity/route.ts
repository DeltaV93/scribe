/**
 * GET /api/calls/[callId]/sensitivity
 * Get sensitivity analysis results for a call.
 *
 * PX-878: Tiered Content Classifier
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/:callId/sensitivity - Get sensitivity results for a call
 *
 * Returns the sensitivity analysis results including:
 * - Overall tier classification
 * - Confidence score
 * - Per-segment analysis
 * - Review status
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    // Fetch call with sensitivity data
    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        client: { orgId: user.orgId },
      },
      select: {
        id: true,
        caseManagerId: true,
        sensitivityAnalysis: true,
        sensitivityTier: true,
        sensitivityConfidence: true,
        sensitivityReviewed: true,
        sensitivityReviewedAt: true,
        sensitivityReviewedById: true,
        pendingSensitivityReview: true,
        sensitivityModelVersion: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Call not found" } },
        { status: 404 }
      );
    }

    // Case managers can only view their own calls
    if (user.role === UserRole.CASE_MANAGER && call.caseManagerId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view this call",
          },
        },
        { status: 403 }
      );
    }

    // Get reviewer info if reviewed
    let reviewer = null;
    if (call.sensitivityReviewedById) {
      reviewer = await prisma.user.findUnique({
        where: { id: call.sensitivityReviewedById },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        callId: call.id,
        clientId: call.client.id,
        clientName: `${call.client.firstName} ${call.client.lastName}`,
        sensitivity: {
          tier: call.sensitivityTier,
          confidence: call.sensitivityConfidence,
          analysis: call.sensitivityAnalysis,
          modelVersion: call.sensitivityModelVersion,
        },
        review: {
          required: call.pendingSensitivityReview,
          completed: call.sensitivityReviewed,
          reviewedAt: call.sensitivityReviewedAt,
          reviewer: reviewer
            ? {
                id: reviewer.id,
                name: reviewer.name,
                email: reviewer.email,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error("[Sensitivity API] Error fetching sensitivity data:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch sensitivity data" } },
      { status: 500 }
    );
  }
}
