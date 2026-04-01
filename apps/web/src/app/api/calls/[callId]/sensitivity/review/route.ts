/**
 * POST /api/calls/[callId]/sensitivity/review
 * Submit human review decision for sensitivity flagged content.
 *
 * PX-878: Tiered Content Classifier
 *
 * When a call is flagged for sensitivity review (REDACT tier or low confidence),
 * the processing pipeline is blocked. This endpoint allows authorized users
 * to confirm or dispute the classification and resume processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/types";
import { SensitivityTier } from "@prisma/client";
import {
  logSensitivityDecision,
  resumeAfterSensitivityReview,
  type SensitivityAction,
} from "@/lib/services/sensitivity";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

interface ReviewRequestBody {
  /** User's decision: confirm, dispute, or escalate */
  action: "CONFIRMED" | "DISPUTED" | "ESCALATED";
  /** If disputed, the tier the reviewer thinks it should be */
  correctedTier?: "STANDARD" | "RESTRICTED" | "REDACTED";
  /** Optional notes about the decision */
  notes?: string;
  /** Segment indices that were reviewed (if reviewing specific segments) */
  segmentIndices?: number[];
}

/**
 * POST /api/calls/:callId/sensitivity/review - Submit review decision
 *
 * Required for calls flagged with pendingSensitivityReview = true.
 * Submitting a review will:
 * 1. Log the decision to the audit log
 * 2. Update the call's sensitivity fields
 * 3. Resume the processing pipeline
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { callId } = await context.params;

    // Only admins and program managers can review sensitivity flags
    const canReview =
      isAdmin(user) || user.role === UserRole.PROGRAM_MANAGER;

    if (!canReview) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only admins and program managers can review sensitivity flags",
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body: ReviewRequestBody = await request.json();

    if (!body.action) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "action is required (CONFIRMED, DISPUTED, or ESCALATED)",
          },
        },
        { status: 400 }
      );
    }

    const validActions: SensitivityAction[] = ["CONFIRMED", "DISPUTED", "ESCALATED"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "action must be CONFIRMED, DISPUTED, or ESCALATED",
          },
        },
        { status: 400 }
      );
    }

    if (body.action === "DISPUTED" && !body.correctedTier) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "correctedTier is required when disputing",
          },
        },
        { status: 400 }
      );
    }

    // Fetch call with sensitivity data
    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        client: { orgId: user.orgId },
      },
      select: {
        id: true,
        pendingSensitivityReview: true,
        sensitivityTier: true,
        sensitivityConfidence: true,
        sensitivityAnalysis: true,
        sensitivityModelVersion: true,
        transcriptRaw: true,
        client: {
          select: {
            orgId: true,
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

    if (!call.pendingSensitivityReview) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_STATE",
            message: "This call is not pending sensitivity review",
          },
        },
        { status: 400 }
      );
    }

    // Determine final tier
    const originalTier = call.sensitivityTier || SensitivityTier.STANDARD;
    const finalTier =
      body.action === "DISPUTED" && body.correctedTier
        ? (body.correctedTier as SensitivityTier)
        : originalTier;

    // Log each segment decision to audit log
    const segments = (call.sensitivityAnalysis as Array<{ text: string }>) || [];
    const segmentIndices = body.segmentIndices || [0]; // Default to first segment if not specified

    for (const segmentIndex of segmentIndices) {
      const segment = segments[segmentIndex];
      if (segment) {
        await logSensitivityDecision({
          orgId: call.client.orgId,
          callId: call.id,
          segmentIndex,
          segmentText: segment.text || "",
          originalTier,
          finalTier,
          action: body.action,
          confidence: call.sensitivityConfidence || 0,
          modelVersion: call.sensitivityModelVersion || "unknown",
          reviewedById: user.id,
        });
      }
    }

    // Update call with final tier if disputed
    if (body.action === "DISPUTED" && body.correctedTier) {
      await prisma.call.update({
        where: { id: callId },
        data: {
          sensitivityTier: finalTier,
        },
      });
    }

    // Resume processing
    const result = await resumeAfterSensitivityReview(callId, user.id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "PROCESSING_ERROR",
            message: result.error || "Failed to resume processing",
          },
        },
        { status: 500 }
      );
    }

    console.log(
      `[Sensitivity Review] Call ${callId} reviewed by ${user.id}: ` +
        `${body.action} (${originalTier} -> ${finalTier})`
    );

    return NextResponse.json({
      success: true,
      data: {
        callId,
        action: body.action,
        originalTier,
        finalTier,
        processingResumed: true,
      },
    });
  } catch (error) {
    console.error("[Sensitivity Review API] Error submitting review:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to submit review" } },
      { status: 500 }
    );
  }
}
