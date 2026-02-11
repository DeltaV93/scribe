/**
 * Client Activity Service (PX-728)
 * Manages the unified activity feed for client records
 * Denormalized for performance at scale
 */

import { prisma } from "@/lib/db";
import { ActivityType, UserRole, Prisma } from "@prisma/client";

export interface CreateActivityParams {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  activityType: ActivityType;
  summary: string;
  rawData: Prisma.InputJsonValue;
  sourceType: string;
  sourceId: string;
}

export interface ActivityFeedItem {
  id: string;
  clientId: string;
  activityType: ActivityType;
  summary: string;
  rawData: Record<string, unknown>;
  sourceType: string;
  sourceId: string;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
  };
}

export interface GetActivityFeedParams {
  clientId: string;
  viewerRole: UserRole;
  limit?: number;
  cursor?: string;
  activityTypes?: ActivityType[];
}

/**
 * Activity types visible to each role
 * FACILITATOR has limited access (no PHI-heavy activities)
 * VIEWER has read-only access to most activities
 */
const ROLE_ACTIVITY_ACCESS: Record<UserRole, ActivityType[]> = {
  SUPER_ADMIN: Object.values(ActivityType),
  ADMIN: Object.values(ActivityType),
  PROGRAM_MANAGER: Object.values(ActivityType),
  CASE_MANAGER: Object.values(ActivityType),
  FACILITATOR: [
    ActivityType.ATTENDANCE_RECORDED,
    ActivityType.ENROLLMENT_CREATED,
    ActivityType.ENROLLMENT_UPDATED,
  ],
  VIEWER: [
    ActivityType.CALL_COMPLETED,
    ActivityType.CALL_MISSED,
    ActivityType.NOTE_ADDED,
    ActivityType.FORM_SUBMITTED,
    ActivityType.ATTENDANCE_RECORDED,
    ActivityType.ENROLLMENT_CREATED,
    ActivityType.ENROLLMENT_UPDATED,
    ActivityType.ACTION_ITEM_CREATED,
    ActivityType.ACTION_ITEM_COMPLETED,
  ],
};

/**
 * Create an activity record
 * Called by other services when events occur
 */
export async function createActivity(params: CreateActivityParams): Promise<void> {
  const {
    clientId,
    actorId,
    actorRole,
    activityType,
    summary,
    rawData,
    sourceType,
    sourceId,
  } = params;

  await prisma.clientActivity.create({
    data: {
      clientId,
      actorId,
      actorRole,
      activityType,
      summary,
      rawData,
      sourceType,
      sourceId,
    },
  });
}

/**
 * Get activity feed for a client with role-based filtering
 * Uses cursor-based pagination for performance
 */
export async function getActivityFeed(
  params: GetActivityFeedParams
): Promise<{ items: ActivityFeedItem[]; nextCursor: string | null }> {
  const { clientId, viewerRole, limit = 20, cursor, activityTypes } = params;

  // Get allowed activity types for this role
  const allowedTypes = ROLE_ACTIVITY_ACCESS[viewerRole] || [];

  // Filter by both allowed types and requested types (if any)
  const filteredTypes = activityTypes
    ? activityTypes.filter((t) => allowedTypes.includes(t))
    : allowedTypes;

  // If no types are accessible, return empty
  if (filteredTypes.length === 0) {
    return { items: [], nextCursor: null };
  }

  const activities = await prisma.clientActivity.findMany({
    where: {
      clientId,
      activityType: { in: filteredTypes },
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra for cursor
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const hasMore = activities.length > limit;
  const items = hasMore ? activities.slice(0, limit) : activities;

  return {
    items: items.map((activity) => ({
      id: activity.id,
      clientId: activity.clientId,
      activityType: activity.activityType,
      summary: activity.summary,
      rawData: activity.rawData as Record<string, unknown>,
      sourceType: activity.sourceType,
      sourceId: activity.sourceId,
      createdAt: activity.createdAt,
      actor: {
        id: activity.actor.id,
        name: activity.actor.name,
        email: activity.actor.email,
        role: activity.actorRole,
      },
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

/**
 * Helper functions to create specific activity types
 * These ensure consistent summary formatting
 */

export async function logCallActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  callId: string;
  completed: boolean;
  duration?: number;
}) {
  const { clientId, actorId, actorRole, callId, completed, duration } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: completed ? ActivityType.CALL_COMPLETED : ActivityType.CALL_MISSED,
    summary: completed
      ? `Call completed${duration ? ` (${Math.round(duration / 60)} min)` : ""}`
      : "Missed call",
    rawData: { callId, completed, duration },
    sourceType: "call",
    sourceId: callId,
  });
}

export async function logNoteActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  noteId: string;
  noteType: string;
}) {
  const { clientId, actorId, actorRole, noteId, noteType } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: ActivityType.NOTE_ADDED,
    summary: `Added ${noteType} note`,
    rawData: { noteId, noteType },
    sourceType: "note",
    sourceId: noteId,
  });
}

export async function logFormActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  submissionId: string;
  formName: string;
  isUpdate: boolean;
}) {
  const { clientId, actorId, actorRole, submissionId, formName, isUpdate } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: isUpdate ? ActivityType.FORM_UPDATED : ActivityType.FORM_SUBMITTED,
    summary: isUpdate ? `Updated form: ${formName}` : `Submitted form: ${formName}`,
    rawData: { submissionId, formName, isUpdate },
    sourceType: "form_submission",
    sourceId: submissionId,
  });
}

export async function logAttendanceActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  attendanceId: string;
  sessionName: string;
  status: string;
}) {
  const { clientId, actorId, actorRole, attendanceId, sessionName, status } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: ActivityType.ATTENDANCE_RECORDED,
    summary: `Attendance: ${status} for ${sessionName}`,
    rawData: { attendanceId, sessionName, status },
    sourceType: "attendance",
    sourceId: attendanceId,
  });
}

export async function logEnrollmentActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  enrollmentId: string;
  programName: string;
  isUpdate: boolean;
  status?: string;
}) {
  const { clientId, actorId, actorRole, enrollmentId, programName, isUpdate, status } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: isUpdate ? ActivityType.ENROLLMENT_UPDATED : ActivityType.ENROLLMENT_CREATED,
    summary: isUpdate
      ? `Enrollment updated: ${programName}${status ? ` (${status})` : ""}`
      : `Enrolled in: ${programName}`,
    rawData: { enrollmentId, programName, isUpdate, status },
    sourceType: "enrollment",
    sourceId: enrollmentId,
  });
}

export async function logActionItemActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  actionItemId: string;
  title: string;
  completed: boolean;
}) {
  const { clientId, actorId, actorRole, actionItemId, title, completed } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: completed ? ActivityType.ACTION_ITEM_COMPLETED : ActivityType.ACTION_ITEM_CREATED,
    summary: completed ? `Completed: ${title}` : `Action item: ${title}`,
    rawData: { actionItemId, title, completed },
    sourceType: "action_item",
    sourceId: actionItemId,
  });
}

export async function logConsentActivity(params: {
  clientId: string;
  actorId: string;
  actorRole: UserRole;
  consentId: string;
  consentType: string;
  granted: boolean;
}) {
  const { clientId, actorId, actorRole, consentId, consentType, granted } = params;

  await createActivity({
    clientId,
    actorId,
    actorRole,
    activityType: granted ? ActivityType.CONSENT_GRANTED : ActivityType.CONSENT_REVOKED,
    summary: granted
      ? `Consent granted for ${consentType}`
      : `Consent revoked for ${consentType}`,
    rawData: { consentId, consentType, granted },
    sourceType: "consent",
    sourceId: consentId,
  });
}

/**
 * Get activity count for a client (useful for badges/indicators)
 */
export async function getActivityCount(
  clientId: string,
  since?: Date
): Promise<number> {
  return prisma.clientActivity.count({
    where: {
      clientId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
  });
}

/**
 * Delete all activities for a client (for data purge scenarios)
 */
export async function deleteClientActivities(clientId: string): Promise<number> {
  const result = await prisma.clientActivity.deleteMany({
    where: { clientId },
  });
  return result.count;
}
