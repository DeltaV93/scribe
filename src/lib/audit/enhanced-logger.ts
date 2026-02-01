/**
 * Enhanced HIPAA-Compliant Audit Logger
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";
import { getGenesisHash } from "./hash-chain";
import {
  AuditEventType,
  AuditSeverity,
  AuditGeolocation,
  AuthAction,
  AdminAction,
  determineSeverity,
} from "./events";
import type { Prisma } from "@prisma/client";

interface EnhancedAuditInput {
  eventType: AuditEventType;
  action: string;
  severity?: AuditSeverity;
  orgId: string;
  userId?: string | null;
  resource: string;
  resourceId: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: AuditGeolocation;
  sessionId?: string;
}

async function getLastHash(orgId: string): Promise<string> {
  const lastEntry = await prisma.auditLog.findFirst({
    where: { orgId },
    orderBy: { timestamp: "desc" },
    select: { hash: true },
  });
  return lastEntry?.hash || getGenesisHash();
}

function calculateHash(data: Record<string, unknown>, previousHash: string): string {
  const content = JSON.stringify({ ...data, previousHash });
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function logEnhancedAudit(input: EnhancedAuditInput) {
  const id = crypto.randomUUID();
  const timestamp = new Date();
  const previousHash = await getLastHash(input.orgId);

  const hashData = {
    id,
    orgId: input.orgId,
    userId: input.userId,
    eventType: input.eventType,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    timestamp: timestamp.toISOString(),
  };

  const hash = calculateHash(hashData, previousHash);
  const severity = input.severity || determineSeverity(input.eventType, input.action);

  // Merge metadata with event type info
  const enhancedDetails = {
    ...(input.details || {}),
    eventType: input.eventType,
    severity,
  };

  return prisma.auditLog.create({
    data: {
      id,
      orgId: input.orgId,
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      details: enhancedDetails as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      previousHash,
      hash,
      timestamp,
    },
  });
}

// Authentication event helpers
export const AuthLogger = {
  async loginSuccess(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    geolocation?: AuditGeolocation;
    sessionId?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.LOGIN_SUCCESS,
      severity: AuditSeverity.MEDIUM,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      sessionId: params.sessionId,
    });
  },

  async loginFailure(params: {
    orgId: string;
    attemptedEmail: string;
    ipAddress?: string;
    userAgent?: string;
    geolocation?: AuditGeolocation;
    failureReason?: string;
    failedAttempts?: number;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.LOGIN_FAILURE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: null,
      resource: "User",
      resourceId: params.attemptedEmail,
      resourceName: params.attemptedEmail,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
      metadata: {
        failureReason: params.failureReason,
        failedAttempts: params.failedAttempts,
      },
    });
  },

  async logout(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
    sessionId?: string;
    explicit?: boolean;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: params.explicit ? AuthAction.LOGOUT : AuthAction.SESSION_TIMEOUT,
      severity: AuditSeverity.LOW,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      sessionId: params.sessionId,
    });
  },

  async passwordChange(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.PASSWORD_CHANGE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
    });
  },

  async accountLockout(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
    failedAttempts: number;
    lockoutDurationMinutes: number;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.ACCOUNT_LOCKOUT,
      severity: AuditSeverity.CRITICAL,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      metadata: {
        failedAttempts: params.failedAttempts,
        lockoutDurationMinutes: params.lockoutDurationMinutes,
      },
    });
  },

  async accountUnlock(params: {
    orgId: string;
    userId: string;
    unlockedBy: string;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.ACCOUNT_UNLOCK,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.unlockedBy,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      metadata: {
        unlockedUserId: params.userId,
      },
    });
  },

  async mfaSetup(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
    mfaMethod?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: AuthAction.MFA_SETUP,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
      metadata: {
        mfaMethod: params.mfaMethod || "TOTP",
      },
    });
  },

  async mfaVerify(params: {
    orgId: string;
    userId: string;
    ipAddress?: string;
    success: boolean;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.AUTH,
      action: params.success ? AuthAction.MFA_VERIFY : AuthAction.MFA_FAILURE,
      severity: params.success ? AuditSeverity.MEDIUM : AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.userId,
      resource: "User",
      resourceId: params.userId,
      ipAddress: params.ipAddress,
    });
  },
};

// Admin event helpers
export const AdminLogger = {
  async userCreated(params: {
    orgId: string;
    actorId: string;
    targetUserId: string;
    targetEmail: string;
    role: string;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.ADMIN,
      action: AdminAction.USER_CREATE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.actorId,
      resource: "User",
      resourceId: params.targetUserId,
      resourceName: params.targetEmail,
      ipAddress: params.ipAddress,
      metadata: {
        targetUserId: params.targetUserId,
        targetEmail: params.targetEmail,
        assignedRole: params.role,
      },
    });
  },

  async userUpdated(params: {
    orgId: string;
    actorId: string;
    targetUserId: string;
    changedFields: string[];
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.ADMIN,
      action: AdminAction.USER_UPDATE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.actorId,
      resource: "User",
      resourceId: params.targetUserId,
      ipAddress: params.ipAddress,
      metadata: {
        changedFields: params.changedFields,
        previousValues: params.previousValues,
        newValues: params.newValues,
      },
    });
  },

  async roleChanged(params: {
    orgId: string;
    actorId: string;
    targetUserId: string;
    previousRole: string;
    newRole: string;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.ADMIN,
      action: AdminAction.ROLE_ASSIGN,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.actorId,
      resource: "User",
      resourceId: params.targetUserId,
      ipAddress: params.ipAddress,
      metadata: {
        previousRole: params.previousRole,
        newRole: params.newRole,
      },
    });
  },

  async orgSettingsUpdated(params: {
    orgId: string;
    actorId: string;
    changedFields: string[];
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return logEnhancedAudit({
      eventType: AuditEventType.ADMIN,
      action: AdminAction.ORG_SETTINGS_UPDATE,
      severity: AuditSeverity.HIGH,
      orgId: params.orgId,
      userId: params.actorId,
      resource: "Organization",
      resourceId: params.orgId,
      ipAddress: params.ipAddress,
      metadata: {
        changedFields: params.changedFields,
        previousValues: params.previousValues,
        newValues: params.newValues,
      },
    });
  },
};
