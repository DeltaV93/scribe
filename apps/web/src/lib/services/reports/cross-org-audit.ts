/**
 * Cross-Organization Audit Service
 *
 * Handles audit logging for cross-org report access (e.g., multi-site organizations,
 * auditors, or consultants accessing multiple org reports).
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";

export type AuditAction =
  | "REPORT_VIEW"
  | "REPORT_DOWNLOAD"
  | "REPORT_GENERATE"
  | "TEMPLATE_ACCESS"
  | "METRIC_EXPORT"
  | "NARRATIVE_VIEW"
  | "DATA_EXPORT";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  userId: string;
  userOrgId: string;
  targetOrgId: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  hash: string;
  previousHash: string;
}

/**
 * Log cross-org access
 */
export async function logCrossOrgAccess(params: {
  action: AuditAction;
  userId: string;
  userOrgId: string;
  targetOrgId: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const {
    action,
    userId,
    userOrgId,
    targetOrgId,
    resourceType,
    resourceId,
    details = {},
    ipAddress,
    userAgent,
  } = params;

  // Get the previous hash for chain integrity
  const previousLog = await prisma.auditLog.findFirst({
    where: { orgId: targetOrgId },
    orderBy: { timestamp: "desc" },
    select: { hash: true },
  });

  const previousHash = previousLog?.hash || "GENESIS";

  // Create the log entry content for hashing
  const logContent = {
    action,
    userId,
    userOrgId,
    targetOrgId,
    resourceType,
    resourceId,
    details,
    timestamp: new Date().toISOString(),
    previousHash,
  };

  // Generate hash
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(logContent))
    .digest("hex");

  // Store the audit log
  await prisma.auditLog.create({
    data: {
      orgId: targetOrgId,
      userId,
      action: `CROSS_ORG_${action}`,
      resource: resourceType,
      resourceId,
      details: {
        ...details,
        sourceOrgId: userOrgId,
        isCrossOrgAccess: true,
      },
      ipAddress,
      userAgent,
      previousHash,
      hash,
    },
  });
}

/**
 * Get cross-org access logs for a target organization
 */
export async function getCrossOrgAccessLogs(
  targetOrgId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }
): Promise<{
  logs: Array<{
    id: string;
    action: string;
    userId: string;
    sourceOrgId: string | null;
    resourceType: string;
    resourceId: string;
    timestamp: Date;
    user: {
      name: string | null;
      email: string;
    } | null;
    sourceOrg: {
      name: string;
    } | null;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = {
    orgId: targetOrgId,
    action: { startsWith: "CROSS_ORG_" },
  };

  if (options?.startDate || options?.endDate) {
    where.timestamp = {
      ...(options.startDate && { gte: options.startDate }),
      ...(options.endDate && { lte: options.endDate }),
    };
  }

  if (options?.action) {
    where.action = `CROSS_ORG_${options.action}`;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      select: {
        id: true,
        action: true,
        userId: true,
        resource: true,
        resourceId: true,
        details: true,
        timestamp: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Enhance with user and source org details
  const enhancedLogs = await Promise.all(
    logs.map(async (log) => {
      const details = log.details as Record<string, unknown>;
      const sourceOrgId = details.sourceOrgId as string | undefined;

      const [user, sourceOrg] = await Promise.all([
        log.userId
          ? prisma.user.findUnique({
              where: { id: log.userId },
              select: { name: true, email: true },
            })
          : null,
        sourceOrgId
          ? prisma.organization.findUnique({
              where: { id: sourceOrgId },
              select: { name: true },
            })
          : null,
      ]);

      return {
        id: log.id,
        action: log.action.replace("CROSS_ORG_", ""),
        userId: log.userId || "",
        sourceOrgId: sourceOrgId || null,
        resourceType: log.resource,
        resourceId: log.resourceId,
        timestamp: log.timestamp,
        user,
        sourceOrg,
      };
    })
  );

  return { logs: enhancedLogs, total };
}

/**
 * Verify audit log chain integrity
 */
export async function verifyAuditChain(
  orgId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  isValid: boolean;
  errors: Array<{
    logId: string;
    timestamp: Date;
    error: string;
  }>;
  totalVerified: number;
}> {
  const where: Record<string, unknown> = { orgId };

  if (options?.startDate || options?.endDate) {
    where.timestamp = {
      ...(options.startDate && { gte: options.startDate }),
      ...(options.endDate && { lte: options.endDate }),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      action: true,
      userId: true,
      resource: true,
      resourceId: true,
      details: true,
      timestamp: true,
      hash: true,
      previousHash: true,
    },
  });

  const errors: Array<{
    logId: string;
    timestamp: Date;
    error: string;
  }> = [];

  let previousHash = "GENESIS";

  for (const log of logs) {
    // Verify chain continuity
    if (log.previousHash !== previousHash) {
      errors.push({
        logId: log.id,
        timestamp: log.timestamp,
        error: `Chain broken: expected previousHash "${previousHash}", got "${log.previousHash}"`,
      });
    }

    // Verify hash computation
    const logContent = {
      action: log.action,
      userId: log.userId,
      resource: log.resource,
      resourceId: log.resourceId,
      details: log.details,
      timestamp: log.timestamp.toISOString(),
      previousHash: log.previousHash,
    };

    const computedHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(logContent))
      .digest("hex");

    if (computedHash !== log.hash) {
      errors.push({
        logId: log.id,
        timestamp: log.timestamp,
        error: `Hash mismatch: computed "${computedHash}", stored "${log.hash}"`,
      });
    }

    previousHash = log.hash;
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalVerified: logs.length,
  };
}

/**
 * Check if a user has cross-org access
 */
export async function checkCrossOrgAccess(
  userId: string,
  targetOrgId: string
): Promise<{
  hasAccess: boolean;
  accessType?: "admin" | "consultant" | "auditor" | "multi_site";
  reason?: string;
}> {
  // Get the user and their org
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      orgId: true,
      role: true,
      organization: {
        select: {
          settings: true,
        },
      },
    },
  });

  if (!user) {
    return { hasAccess: false, reason: "User not found" };
  }

  // Same org - always allowed
  if (user.orgId === targetOrgId) {
    return { hasAccess: true, accessType: "admin" };
  }

  // Check org settings for cross-org access configuration
  const settings = user.organization?.settings as Record<string, unknown> | null;

  // Check for multi-site organization
  const linkedOrgs = settings?.linkedOrganizations as string[] | undefined;
  if (linkedOrgs?.includes(targetOrgId)) {
    return { hasAccess: true, accessType: "multi_site" };
  }

  // Check for auditor/consultant access
  const targetOrg = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { settings: true },
  });

  const targetSettings = targetOrg?.settings as Record<string, unknown> | null;
  const authorizedAuditors = targetSettings?.authorizedAuditors as string[] | undefined;

  if (authorizedAuditors?.includes(userId)) {
    return { hasAccess: true, accessType: "auditor" };
  }

  // Super admin check
  if (user.role === "SUPER_ADMIN") {
    return { hasAccess: true, accessType: "admin" };
  }

  return { hasAccess: false, reason: "No cross-org access configured" };
}

/**
 * Generate cross-org access report
 */
export async function generateCrossOrgReport(
  orgId: string,
  options: {
    startDate: Date;
    endDate: Date;
  }
): Promise<{
  summary: {
    totalAccesses: number;
    uniqueUsers: number;
    uniqueSourceOrgs: number;
    byAction: Record<string, number>;
  };
  accessors: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    sourceOrgName: string;
    accessCount: number;
    lastAccess: Date;
    actions: string[];
  }>;
}> {
  const logs = await prisma.auditLog.findMany({
    where: {
      orgId,
      action: { startsWith: "CROSS_ORG_" },
      timestamp: {
        gte: options.startDate,
        lte: options.endDate,
      },
    },
    select: {
      userId: true,
      action: true,
      details: true,
      timestamp: true,
    },
  });

  // Calculate summary
  const byAction: Record<string, number> = {};
  const uniqueUsers = new Set<string>();
  const uniqueSourceOrgs = new Set<string>();
  const accessorMap = new Map<
    string,
    {
      userId: string;
      sourceOrgId: string;
      accessCount: number;
      lastAccess: Date;
      actions: Set<string>;
    }
  >();

  for (const log of logs) {
    if (!log.userId) continue;

    const action = log.action.replace("CROSS_ORG_", "");
    byAction[action] = (byAction[action] || 0) + 1;

    uniqueUsers.add(log.userId);

    const details = log.details as Record<string, unknown>;
    const sourceOrgId = details.sourceOrgId as string | undefined;
    if (sourceOrgId) {
      uniqueSourceOrgs.add(sourceOrgId);
    }

    const key = `${log.userId}_${sourceOrgId}`;
    const existing = accessorMap.get(key);

    if (existing) {
      existing.accessCount++;
      existing.actions.add(action);
      if (log.timestamp > existing.lastAccess) {
        existing.lastAccess = log.timestamp;
      }
    } else {
      accessorMap.set(key, {
        userId: log.userId,
        sourceOrgId: sourceOrgId || "",
        accessCount: 1,
        lastAccess: log.timestamp,
        actions: new Set([action]),
      });
    }
  }

  // Enhance accessor data with names
  const accessors = await Promise.all(
    Array.from(accessorMap.values()).map(async (accessor) => {
      const [user, sourceOrg] = await Promise.all([
        prisma.user.findUnique({
          where: { id: accessor.userId },
          select: { name: true, email: true },
        }),
        accessor.sourceOrgId
          ? prisma.organization.findUnique({
              where: { id: accessor.sourceOrgId },
              select: { name: true },
            })
          : null,
      ]);

      return {
        userId: accessor.userId,
        userName: user?.name || null,
        userEmail: user?.email || "",
        sourceOrgName: sourceOrg?.name || "Unknown",
        accessCount: accessor.accessCount,
        lastAccess: accessor.lastAccess,
        actions: Array.from(accessor.actions),
      };
    })
  );

  // Sort by access count
  accessors.sort((a, b) => b.accessCount - a.accessCount);

  return {
    summary: {
      totalAccesses: logs.length,
      uniqueUsers: uniqueUsers.size,
      uniqueSourceOrgs: uniqueSourceOrgs.size,
      byAction,
    },
    accessors,
  };
}
