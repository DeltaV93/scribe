/**
 * Session Status History Service (PX-723)
 * Tracks and retrieves session status change history
 */

import { prisma } from "@/lib/db";
import { SessionStatus, Prisma } from "@prisma/client";
import { AuditLogger } from "@/lib/audit/service";

export interface StatusChangeParams {
  sessionId: string;
  oldStatus: SessionStatus | null;
  newStatus: SessionStatus;
  changedById: string;
  reason?: string;
  rescheduledToId?: string;
}

export interface StatusHistoryEntry {
  id: string;
  oldStatus: SessionStatus | null;
  newStatus: SessionStatus;
  changedAt: Date;
  changedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  reason: string | null;
  rescheduledToId: string | null;
}

/**
 * Record a status change in the session history
 * Also logs to audit if the session has enrolled clients (HIPAA requirement)
 */
export async function recordStatusChange(params: StatusChangeParams): Promise<void> {
  const { sessionId, oldStatus, newStatus, changedById, reason, rescheduledToId } = params;

  // Create history record
  await prisma.sessionStatusHistory.create({
    data: {
      sessionId,
      oldStatus,
      newStatus,
      changedById,
      reason,
      rescheduledToId,
    },
  });

  // Check if session has enrolled clients - if so, log to HIPAA audit
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ENROLLED", "IN_PROGRESS"] } },
            take: 1,
          },
          organization: true,
        },
      },
    },
  });

  if (session?.program.enrollments.length) {
    // Session has enrolled clients - log to audit trail
    await AuditLogger.log({
      organizationId: session.program.organization.id,
      userId: changedById,
      action: "SESSION_STATUS_CHANGED",
      resourceType: "SESSION",
      resourceId: sessionId,
      details: {
        programId: session.programId,
        oldStatus,
        newStatus,
        reason,
        enrolledCount: session.program.enrollments.length,
      },
    });
  }
}

/**
 * Get status history for a session
 */
export async function getSessionStatusHistory(
  sessionId: string
): Promise<StatusHistoryEntry[]> {
  const history = await prisma.sessionStatusHistory.findMany({
    where: { sessionId },
    orderBy: { changedAt: "desc" },
    include: {
      changedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return history.map((entry) => ({
    id: entry.id,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
    changedAt: entry.changedAt,
    changedBy: entry.changedBy,
    reason: entry.reason,
    rescheduledToId: entry.rescheduledToId,
  }));
}

/**
 * Update session status with history tracking
 * This is the main function to use when changing session status
 */
export async function updateSessionStatus(params: {
  sessionId: string;
  newStatus: SessionStatus;
  changedById: string;
  reason?: string;
  rescheduledToId?: string;
}): Promise<void> {
  const { sessionId, newStatus, changedById, reason, rescheduledToId } = params;

  // Get current session status
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const oldStatus = session.status;

  // Skip if status hasn't changed
  if (oldStatus === newStatus) {
    return;
  }

  // Update session and record history in a transaction
  await prisma.$transaction(async (tx) => {
    // Update session status
    await tx.programSession.update({
      where: { id: sessionId },
      data: {
        status: newStatus,
        rescheduledToId: rescheduledToId || undefined,
      },
    });

    // Record history
    await tx.sessionStatusHistory.create({
      data: {
        sessionId,
        oldStatus,
        newStatus,
        changedById,
        reason,
        rescheduledToId,
      },
    });
  });

  // Log audit if needed (outside transaction for performance)
  const sessionWithEnrollments = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: {
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ENROLLED", "IN_PROGRESS"] } },
            take: 1,
          },
          organization: true,
        },
      },
    },
  });

  if (sessionWithEnrollments?.program.enrollments.length) {
    await AuditLogger.log({
      organizationId: sessionWithEnrollments.program.organization.id,
      userId: changedById,
      action: "SESSION_STATUS_CHANGED",
      resourceType: "SESSION",
      resourceId: sessionId,
      details: {
        programId: sessionWithEnrollments.programId,
        oldStatus,
        newStatus,
        reason,
      },
    });
  }
}
