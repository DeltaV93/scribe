/**
 * Session Status Update API (PX-724)
 * PATCH: Update session status with history tracking
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-auth-audit";
import { updateSessionStatus } from "@/lib/services/session-status-history";
import { dismissSessionReminders } from "@/lib/services/draft-reminders";
import { prisma } from "@/lib/db";
import { SessionStatus, UserRole } from "@prisma/client";

// Status transitions that require confirmation (going "backward")
const BACKWARD_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  DRAFT: [],
  SCHEDULED: [SessionStatus.DRAFT],
  IN_PROGRESS: [SessionStatus.DRAFT, SessionStatus.SCHEDULED],
  COMPLETED: [SessionStatus.DRAFT, SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS],
  CANCELED: [], // Canceling doesn't require confirmation for backward
  RESCHEDULED: [], // Rescheduling is its own flow
};

/**
 * Check if a status transition is "backward" and requires confirmation
 */
function isBackwardTransition(
  oldStatus: SessionStatus,
  newStatus: SessionStatus
): boolean {
  return BACKWARD_TRANSITIONS[oldStatus]?.includes(newStatus) ?? false;
}

/**
 * PATCH /api/sessions/[sessionId]/status
 * Update session status with optional reason
 */
export const PATCH = withAuth(async (request, context, user) => {
  const params = await context.params;
  const sessionId = params.sessionId;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const { status, reason, rescheduledToId, confirmBackward } = body as {
    status?: string;
    reason?: string;
    rescheduledToId?: string;
    confirmBackward?: boolean;
  };

  // Validate status
  if (!status || !Object.values(SessionStatus).includes(status as SessionStatus)) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: `Invalid status. Must be one of: ${Object.values(SessionStatus).join(", ")}`,
        },
      },
      { status: 400 }
    );
  }

  const newStatus = status as SessionStatus;

  // Verify session exists and user has access
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        select: {
          organizationId: true,
          facilitatorId: true,
          creatorId: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Session not found" } },
      { status: 404 }
    );
  }

  // Verify org access
  if (session.program.organizationId !== user.orgId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Access denied" } },
      { status: 403 }
    );
  }

  // Check permissions - only ADMIN, PROGRAM_MANAGER, or the facilitator can update status
  const canUpdateStatus =
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.PROGRAM_MANAGER ||
    session.program.facilitatorId === user.id ||
    session.program.creatorId === user.id;

  if (!canUpdateStatus) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions to update session status" } },
      { status: 403 }
    );
  }

  // Check for backward transition
  const oldStatus = session.status;
  if (isBackwardTransition(oldStatus, newStatus) && !confirmBackward) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: "This status change moves the session backward and requires confirmation",
          requiresConfirmation: true,
          oldStatus,
          newStatus,
        },
      },
      { status: 409 }
    );
  }

  // Validate rescheduledToId if status is RESCHEDULED
  if (newStatus === SessionStatus.RESCHEDULED) {
    if (!rescheduledToId) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "rescheduledToId is required when setting status to RESCHEDULED",
          },
        },
        { status: 400 }
      );
    }

    // Verify the target session exists
    const targetSession = await prisma.programSession.findUnique({
      where: { id: rescheduledToId },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Target session for reschedule not found" } },
        { status: 400 }
      );
    }
  }

  // Update status with history
  await updateSessionStatus({
    sessionId,
    newStatus,
    changedById: user.id,
    reason,
    rescheduledToId,
  });

  // If moving from DRAFT to any active status, dismiss draft reminders
  if (oldStatus === SessionStatus.DRAFT && newStatus !== SessionStatus.DRAFT) {
    await dismissSessionReminders(sessionId);
  }

  // Fetch updated session
  const updatedSession = await prisma.programSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      rescheduledToId: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: updatedSession,
  });
});
