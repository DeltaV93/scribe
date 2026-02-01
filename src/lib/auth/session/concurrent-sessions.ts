/**
 * Concurrent Session Management
 *
 * Handles multi-session management including:
 * - Enforcing maximum concurrent session limits per user
 * - Session invalidation on security events (password/MFA changes)
 * - Session listing and termination
 */

import { prisma } from "@/lib/db";
import {
  type SessionSummary,
  type ConcurrentSessionCheckResult,
  type DeviceInfo,
  SessionInvalidationReason,
  CONCURRENT_SESSION_LIMITS,
  DEFAULT_CONCURRENT_CONFIG,
} from "./types";
import {
  getActiveSessionsForUser,
  terminateSession,
  terminateAllSessions,
  getSessionSummaries,
} from "./timeout";

// ============================================
// CONCURRENT SESSION CHECKS
// ============================================

/**
 * Check if user can create a new session
 */
export async function checkConcurrentSessions(
  userId: string
): Promise<ConcurrentSessionCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: {
        select: { maxConcurrentSessions: true },
      },
    },
  });

  if (!user) {
    return {
      canCreateSession: false,
      currentSessionCount: 0,
      maxAllowed: DEFAULT_CONCURRENT_CONFIG.maxSessions,
      activeSessions: [],
    };
  }

  const maxSessions = user.organization.maxConcurrentSessions ?? DEFAULT_CONCURRENT_CONFIG.maxSessions;
  const sessions = await getActiveSessionsForUser(userId);
  const summaries = await getSessionSummaries(userId);

  return {
    canCreateSession: sessions.length < maxSessions,
    currentSessionCount: sessions.length,
    maxAllowed: maxSessions,
    activeSessions: summaries,
  };
}

/**
 * Get concurrent session limit for organization
 */
export async function getMaxConcurrentSessions(orgId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { maxConcurrentSessions: true },
  });

  return org?.maxConcurrentSessions ?? DEFAULT_CONCURRENT_CONFIG.maxSessions;
}

/**
 * Update concurrent session limit for organization
 */
export async function updateMaxConcurrentSessions(
  orgId: string,
  maxSessions: number
): Promise<{ success: boolean; error?: string }> {
  // Validate limit
  if (maxSessions < CONCURRENT_SESSION_LIMITS.min) {
    return {
      success: false,
      error: `Maximum concurrent sessions must be at least ${CONCURRENT_SESSION_LIMITS.min}`,
    };
  }

  if (maxSessions > CONCURRENT_SESSION_LIMITS.max) {
    return {
      success: false,
      error: `Maximum concurrent sessions cannot exceed ${CONCURRENT_SESSION_LIMITS.max}`,
    };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { maxConcurrentSessions: maxSessions },
  });

  return { success: true };
}

// ============================================
// SESSION TERMINATION ON SECURITY EVENTS
// ============================================

/**
 * Invalidate all sessions when password is changed
 * Should be called after a successful password change
 */
export async function invalidateSessionsOnPasswordChange(
  userId: string,
  currentSessionId?: string
): Promise<number> {
  // If current session is provided, keep it alive
  if (currentSessionId) {
    return await terminateAllSessionsExcept(
      userId,
      currentSessionId,
      SessionInvalidationReason.PASSWORD_CHANGE
    );
  }

  // Otherwise, terminate all sessions
  return await terminateAllSessions(userId, SessionInvalidationReason.PASSWORD_CHANGE);
}

/**
 * Invalidate all sessions when MFA settings are changed
 * Should be called after MFA is enabled, disabled, or reset
 */
export async function invalidateSessionsOnMfaChange(
  userId: string,
  currentSessionId?: string
): Promise<number> {
  if (currentSessionId) {
    return await terminateAllSessionsExcept(
      userId,
      currentSessionId,
      SessionInvalidationReason.MFA_CHANGE
    );
  }

  return await terminateAllSessions(userId, SessionInvalidationReason.MFA_CHANGE);
}

/**
 * Admin-initiated session revocation
 * Used when admin needs to force logout a user
 */
export async function adminRevokeAllSessions(
  userId: string,
  adminId: string
): Promise<number> {
  // Log the admin action
  await prisma.auditLog.create({
    data: {
      orgId: (await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } }))?.orgId ?? "",
      userId: adminId,
      action: "ADMIN_SESSION_REVOKE",
      resource: "USER_SESSION",
      resourceId: userId,
      resourceName: "All sessions",
      details: { targetUserId: userId, reason: "Admin initiated revocation" },
      previousHash: "",
      hash: "",
    },
  });

  return await terminateAllSessions(userId, SessionInvalidationReason.ADMIN_REVOKED);
}

/**
 * Terminate all sessions except the specified one
 */
async function terminateAllSessionsExcept(
  userId: string,
  exceptSessionId: string,
  reason: SessionInvalidationReason
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      id: { not: exceptSessionId },
    },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: reason,
    },
  });

  return result.count;
}

// ============================================
// SESSION LIST & MANAGEMENT
// ============================================

/**
 * Get all active sessions for a user with device details
 */
export async function listUserSessions(
  userId: string,
  currentSessionToken?: string
): Promise<SessionSummary[]> {
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivity: "desc" },
  });

  return sessions.map((session) => ({
    id: session.id,
    deviceInfo: session.deviceInfo as unknown as DeviceInfo,
    ipAddress: session.ipAddress,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    isCurrent: session.token === currentSessionToken,
  }));
}

/**
 * Terminate a specific session by ID
 * Only the session owner or an admin can terminate
 */
export async function terminateSessionById(
  sessionId: string,
  requesterId: string,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });

  if (!session) {
    return { success: false, error: "Session not found" };
  }

  // Check authorization
  if (!isAdmin && session.userId !== requesterId) {
    return { success: false, error: "Not authorized to terminate this session" };
  }

  const success = await terminateSession(
    sessionId,
    session.userId,
    isAdmin ? SessionInvalidationReason.ADMIN_REVOKED : SessionInvalidationReason.USER_LOGOUT
  );

  return { success };
}

/**
 * Terminate all other sessions (user stays logged in on current device)
 */
export async function terminateOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<{ success: boolean; terminatedCount: number }> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      id: { not: currentSessionId },
    },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: SessionInvalidationReason.USER_LOGOUT,
    },
  });

  return { success: true, terminatedCount: result.count };
}

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Check for suspicious session activity
 * Returns true if activity seems suspicious
 */
export async function checkSuspiciousActivity(userId: string): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  const sessions = await getActiveSessionsForUser(userId);
  const reasons: string[] = [];

  // Check for sessions from multiple unusual locations
  const uniqueIps = new Set(sessions.map((s) => s.ipAddress));
  if (uniqueIps.size > 5) {
    reasons.push("Sessions from many different IP addresses");
  }

  // Check for rapid session creation
  const recentSessions = sessions.filter(
    (s) => Date.now() - new Date(s.createdAt).getTime() < 60 * 60 * 1000 // Last hour
  );
  if (recentSessions.length > 10) {
    reasons.push("Many sessions created in the last hour");
  }

  // Check for mixed device types that seem unusual
  const devices = sessions.map((s) => (s.deviceInfo as DeviceInfo).device);
  const uniqueDevices = new Set(devices);
  if (uniqueDevices.size > 3) {
    reasons.push("Sessions from many different device types");
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Get session statistics for a user
 */
export async function getSessionStats(userId: string): Promise<{
  activeCount: number;
  totalCreated: number;
  averageSessionDuration: number;
  mostUsedDevice: string;
}> {
  const allSessions = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100, // Limit to recent sessions
  });

  const activeSessions = allSessions.filter(
    (s) => s.isActive && new Date(s.expiresAt) > new Date()
  );

  // Calculate average session duration
  const completedSessions = allSessions.filter((s) => !s.isActive && s.terminatedAt);
  const durations = completedSessions.map((s) =>
    s.terminatedAt
      ? new Date(s.terminatedAt).getTime() - new Date(s.createdAt).getTime()
      : 0
  );
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 1000 / 60 // in minutes
      : 0;

  // Find most used device
  const deviceCounts = new Map<string, number>();
  allSessions.forEach((s) => {
    const device = (s.deviceInfo as unknown as DeviceInfo)?.device || "Unknown";
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
  });

  let mostUsedDevice = "Unknown";
  let maxCount = 0;
  deviceCounts.forEach((count, device) => {
    if (count > maxCount) {
      maxCount = count;
      mostUsedDevice = device;
    }
  });

  return {
    activeCount: activeSessions.length,
    totalCreated: allSessions.length,
    averageSessionDuration: Math.round(avgDuration),
    mostUsedDevice,
  };
}
