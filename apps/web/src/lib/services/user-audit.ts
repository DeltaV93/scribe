import { prisma } from "@/lib/db";
import crypto from "crypto";

// ============================================
// Types
// ============================================

export type UserManagementAction =
  | "USER_INVITED"
  | "USER_INVITE_RESENT"
  | "USER_INVITE_REVOKED"
  | "USER_INVITE_ACCEPTED"
  | "USER_INVITE_EXPIRED"
  | "USER_ROLE_CHANGED"
  | "USER_TEAM_CHANGED"
  | "USER_DETAILS_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "USER_DATA_TRANSFERRED"
  | "USER_DELETED";

export interface UserAuditLogInput {
  action: UserManagementAction;
  actorId: string;
  orgId: string;
  targetUserId?: string;
  targetEmail?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserAuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  resourceName: string | null;
  details: Record<string, unknown>;
  userId: string | null;
  timestamp: Date;
  actor?: {
    id: string;
    name: string | null;
    email: string;
  };
}

// ============================================
// Audit Logging Service
// ============================================

/**
 * Generate hash for audit log entry (chain integrity)
 */
async function generateAuditHash(
  orgId: string,
  data: Record<string, unknown>
): Promise<{ previousHash: string; hash: string }> {
  // Get the last audit log entry for this org
  const lastEntry = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "desc" },
    select: { hash: true },
  });

  const previousHash = lastEntry?.hash || "GENESIS";
  const dataString = JSON.stringify({ previousHash, ...data, timestamp: Date.now() });
  const hash = crypto.createHash("sha256").update(dataString).digest("hex");

  return { previousHash, hash };
}

/**
 * Log a user management action to the audit trail
 */
export async function logUserManagementAction(
  input: UserAuditLogInput
): Promise<void> {
  const {
    action,
    actorId,
    orgId,
    targetUserId,
    targetEmail,
    targetName,
    details = {},
    ipAddress,
    userAgent,
  } = input;

  const resourceId = targetUserId || targetEmail || "unknown";
  const resourceName = targetName || targetEmail || null;

  const auditData = {
    action,
    resource: "USER",
    resourceId,
    resourceName,
    details: {
      ...details,
      targetEmail,
      targetName,
    },
  };

  const { previousHash, hash } = await generateAuditHash(orgId, auditData);

  await prisma.auditLog.create({
    data: {
      orgId,
      userId: actorId,
      action,
      resource: "USER",
      resourceId,
      resourceName,
      details: {
        ...details,
        targetEmail,
        targetName,
      },
      ipAddress,
      userAgent,
      previousHash,
      hash,
    },
  });
}

/**
 * Get user management audit logs for an organization
 */
export async function getUserAuditLogs(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: UserManagementAction;
    targetUserId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<{ entries: UserAuditLogEntry[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    action,
    targetUserId,
    startDate,
    endDate,
  } = options;

  const where = {
    orgId,
    resource: "USER",
    ...(action && { action }),
    ...(targetUserId && { resourceId: targetUserId }),
    ...(startDate && { timestamp: { gte: startDate } }),
    ...(endDate && { timestamp: { lte: endDate } }),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        resourceName: true,
        details: true,
        userId: true,
        timestamp: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Fetch actor details
  const actorIds = [...new Set(entries.map((e) => e.userId).filter(Boolean))] as string[];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const entriesWithActors = entries.map((entry) => ({
    ...entry,
    details: entry.details as Record<string, unknown>,
    actor: entry.userId ? actorMap.get(entry.userId) : undefined,
  }));

  return { entries: entriesWithActors, total };
}

/**
 * Export audit logs to JSON (for compliance)
 */
export async function exportUserAuditLogs(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<UserAuditLogEntry[]> {
  const { entries } = await getUserAuditLogs(orgId, {
    startDate,
    endDate,
    limit: 10000, // Max export limit
  });

  return entries;
}
