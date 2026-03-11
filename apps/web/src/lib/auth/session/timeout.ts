/**
 * Session Timeout Logic
 *
 * Handles session timeout calculations and validation.
 * Sessions expire after a configurable period of inactivity (default 30 minutes).
 */

import { prisma } from "@/lib/db";
import {
  type DeviceInfo,
  type SessionSummary,
  type SessionInvalidationReason,
  calculateExpiresAt,
  isSessionExpired,
  getRemainingSeconds,
  parseUserAgent,
  generateSessionToken,
  DEFAULT_SESSION_CONFIG,
  SESSION_TIMEOUT_LIMITS,
} from "./types";

// ============================================
// SESSION CRUD OPERATIONS
// ============================================

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  timeoutMinutes?: number
): Promise<{ session: SessionRecord; token: string } | null> {
  // Get organization settings for timeout
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: {
        select: {
          sessionTimeoutMinutes: true,
          maxConcurrentSessions: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  const timeout = timeoutMinutes ?? user.organization.sessionTimeoutMinutes ?? DEFAULT_SESSION_CONFIG.timeoutMinutes;
  const maxSessions = user.organization.maxConcurrentSessions ?? 3;

  // Check concurrent session limit
  const activeSessions = await getActiveSessionsForUser(userId);

  if (activeSessions.length >= maxSessions) {
    // Terminate the oldest session to make room
    const oldestSession = activeSessions.reduce((oldest, current) =>
      current.createdAt < oldest.createdAt ? current : oldest
    );
    await terminateSession(oldestSession.id, userId, "CONCURRENT_LIMIT");
  }

  const token = generateSessionToken();
  const deviceInfo = parseUserAgent(userAgent);
  const expiresAt = calculateExpiresAt(timeout);

  const session = await prisma.userSession.create({
    data: {
      userId,
      token,
      deviceInfo: deviceInfo as object,
      ipAddress,
      lastActivity: new Date(),
      expiresAt,
      isActive: true,
    },
  });

  return {
    session: session as unknown as SessionRecord,
    token,
  };
}

/**
 * Get a session by token
 */
export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  const session = await prisma.userSession.findUnique({
    where: { token },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (isSessionExpired(session.expiresAt)) {
    await terminateSession(session.id, session.userId, "TIMEOUT");
    return null;
  }

  return session as unknown as SessionRecord;
}

/**
 * Get a session by ID
 */
export async function getSessionById(sessionId: string): Promise<SessionRecord | null> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  return session as unknown as SessionRecord | null;
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessionsForUser(userId: string): Promise<SessionRecord[]> {
  // Clean up expired sessions first
  await cleanupExpiredSessions(userId);

  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivity: "desc" },
  });

  return sessions as unknown as SessionRecord[];
}

/**
 * Get session summaries for display
 */
export async function getSessionSummaries(
  userId: string,
  currentSessionId?: string
): Promise<SessionSummary[]> {
  const sessions = await getActiveSessionsForUser(userId);

  return sessions.map((session) => ({
    id: session.id,
    deviceInfo: session.deviceInfo as DeviceInfo,
    ipAddress: session.ipAddress,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    isCurrent: session.id === currentSessionId,
  }));
}

// ============================================
// SESSION REFRESH/HEARTBEAT
// ============================================

/**
 * Refresh a session's expiration time (heartbeat)
 * Called periodically to keep the session alive while user is active
 */
export async function refreshSession(
  sessionId: string,
  userId: string
): Promise<{ expiresAt: Date; remainingSeconds: number } | null> {
  // Verify session belongs to user
  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId,
      isActive: true,
    },
    include: {
      user: {
        include: {
          organization: {
            select: { sessionTimeoutMinutes: true },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if already expired
  if (isSessionExpired(session.expiresAt)) {
    await terminateSession(sessionId, userId, "TIMEOUT");
    return null;
  }

  const timeoutMinutes =
    session.user.organization.sessionTimeoutMinutes ?? DEFAULT_SESSION_CONFIG.timeoutMinutes;
  const newExpiresAt = calculateExpiresAt(timeoutMinutes);

  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      lastActivity: new Date(),
      expiresAt: newExpiresAt,
    },
  });

  return {
    expiresAt: newExpiresAt,
    remainingSeconds: getRemainingSeconds(newExpiresAt),
  };
}

/**
 * Check session timeout status
 */
export async function checkSessionTimeout(
  sessionId: string
): Promise<{
  isValid: boolean;
  isExpiringSoon: boolean;
  expiresAt: Date | null;
  remainingSeconds: number;
} | null> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          organization: {
            select: { sessionTimeoutMinutes: true },
          },
        },
      },
    },
  });

  if (!session || !session.isActive) {
    return null;
  }

  const expired = isSessionExpired(session.expiresAt);
  const remainingSeconds = getRemainingSeconds(session.expiresAt);
  const warningThreshold = DEFAULT_SESSION_CONFIG.warningMinutes * 60;

  return {
    isValid: !expired,
    isExpiringSoon: !expired && remainingSeconds <= warningThreshold,
    expiresAt: session.expiresAt,
    remainingSeconds,
  };
}

// ============================================
// SESSION TERMINATION
// ============================================

/**
 * Terminate a specific session
 */
export async function terminateSession(
  sessionId: string,
  userId: string,
  reason: SessionInvalidationReason | string
): Promise<boolean> {
  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
  });

  if (!session) {
    return false;
  }

  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: reason,
    },
  });

  return true;
}

/**
 * Terminate all sessions for a user except the current one
 */
export async function terminateAllOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      id: { not: currentSessionId },
    },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: "USER_LOGOUT",
    },
  });

  return result.count;
}

/**
 * Terminate all sessions for a user (e.g., on password change)
 */
export async function terminateAllSessions(
  userId: string,
  reason: SessionInvalidationReason | string
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
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
// SESSION CLEANUP
// ============================================

/**
 * Clean up expired sessions for a user
 */
export async function cleanupExpiredSessions(userId: string): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { lt: new Date() },
    },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: "TIMEOUT",
    },
  });

  return result.count;
}

/**
 * Clean up all expired sessions (for scheduled job)
 */
export async function cleanupAllExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      isActive: true,
      expiresAt: { lt: new Date() },
    },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: "TIMEOUT",
    },
  });

  return result.count;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate session timeout configuration
 */
export function validateTimeoutConfig(minutes: number): {
  isValid: boolean;
  error?: string;
  value: number;
} {
  if (minutes < SESSION_TIMEOUT_LIMITS.min) {
    return {
      isValid: false,
      error: `Session timeout must be at least ${SESSION_TIMEOUT_LIMITS.min} minutes`,
      value: SESSION_TIMEOUT_LIMITS.min,
    };
  }

  if (minutes > SESSION_TIMEOUT_LIMITS.max) {
    return {
      isValid: false,
      error: `Session timeout cannot exceed ${SESSION_TIMEOUT_LIMITS.max} minutes`,
      value: SESSION_TIMEOUT_LIMITS.max,
    };
  }

  return { isValid: true, value: minutes };
}

// ============================================
// TYPES
// ============================================

interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  terminatedAt?: Date | null;
  terminationReason?: string | null;
}
