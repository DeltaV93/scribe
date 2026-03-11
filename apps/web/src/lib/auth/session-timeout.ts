/**
 * Session Timeout Management with Sliding Window and Absolute Maximum
 *
 * This module provides enhanced session timeout handling with:
 * - Sliding timeout (30 minutes of inactivity)
 * - Absolute maximum timeout (12 hours from session creation)
 * - Warning notifications (5 minutes before expiry)
 *
 * HIPAA/SOC2 Compliance:
 * - Sessions are automatically invalidated after timeout periods
 * - All session operations are logged for audit purposes
 * - Secure token generation using cryptographic methods
 */

import { prisma } from "@/lib/db";
import {
  parseUserAgent,
  generateSessionToken,
  isSessionExpired,
  getRemainingSeconds,
  DEFAULT_SESSION_CONFIG,
} from "./session/types";

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

/** Sliding timeout in minutes - session extends with activity */
export const SLIDING_TIMEOUT_MINUTES = 30;

/** Absolute maximum session duration in hours */
export const ABSOLUTE_TIMEOUT_HOURS = 12;

/** Warning period before session expiry in minutes */
export const WARNING_BEFORE_MINUTES = 5;

/** Heartbeat interval for activity tracking (in milliseconds) */
export const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

// ============================================
// TYPES
// ============================================

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
    userAgent: string;
  };
  ipAddress: string;
  lastActivity: Date;
  createdAt: Date;
  slidingExpiresAt: Date;
  absoluteExpiresAt: Date;
  isActive: boolean;
}

export interface SessionStatus {
  valid: boolean;
  expiresIn: number; // Seconds until sliding timeout
  absoluteExpiresIn: number; // Seconds until absolute timeout
  warningActive: boolean; // True if within warning period
  expiredReason?: "sliding" | "absolute" | "invalidated";
}

export interface CreateSessionResult {
  session: UserSession;
  token: string;
}

// ============================================
// SESSION CREATION
// ============================================

/**
 * Create a new session for a user with both sliding and absolute timeouts
 *
 * @param userId - The user's database ID
 * @param ipAddress - Client IP address for security tracking
 * @param userAgent - Browser user agent string
 * @returns Created session with token, or null if user not found
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<CreateSessionResult | null> {
  // Verify user exists and get org settings
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
    console.error(`[Session] Failed to create session: User ${userId} not found`);
    return null;
  }

  // Use org-specific timeout if configured, otherwise use default
  const slidingTimeoutMinutes =
    user.organization.sessionTimeoutMinutes ?? SLIDING_TIMEOUT_MINUTES;
  const maxSessions = user.organization.maxConcurrentSessions ?? 3;

  // Check and enforce concurrent session limit
  const activeSessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
  });

  // If at limit, terminate oldest session
  if (activeSessions.length >= maxSessions) {
    const oldestSession = activeSessions[0];
    await prisma.userSession.update({
      where: { id: oldestSession.id },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: "CONCURRENT_LIMIT",
      },
    });
    console.info(
      `[Session] Terminated oldest session ${oldestSession.id} for user ${userId} due to concurrent limit`
    );
  }

  const now = new Date();
  const token = generateSessionToken();
  const deviceInfo = parseUserAgent(userAgent || "Unknown");

  // Calculate expiration times
  const slidingExpiresAt = new Date(now.getTime() + slidingTimeoutMinutes * 60 * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000);

  // Use the earlier of sliding or absolute for the actual expiresAt
  const expiresAt = slidingExpiresAt < absoluteExpiresAt ? slidingExpiresAt : absoluteExpiresAt;

  const session = await prisma.userSession.create({
    data: {
      userId,
      token,
      deviceInfo: deviceInfo as object,
      ipAddress: ipAddress || "unknown",
      lastActivity: now,
      expiresAt,
      isActive: true,
    },
  });

  console.info(
    `[Session] Created session ${session.id} for user ${userId}, ` +
      `sliding expires: ${slidingExpiresAt.toISOString()}, ` +
      `absolute expires: ${absoluteExpiresAt.toISOString()}`
  );

  return {
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      deviceInfo: session.deviceInfo as UserSession["deviceInfo"],
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      slidingExpiresAt: session.expiresAt,
      absoluteExpiresAt,
      isActive: session.isActive,
    },
    token,
  };
}

// ============================================
// SESSION ACTIVITY UPDATE
// ============================================

/**
 * Update session activity timestamp and extend sliding timeout
 * Does NOT extend past the absolute timeout
 *
 * @param sessionId - The session's database ID
 * @returns void - Throws if session not found or invalid
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
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

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (!session.isActive) {
    throw new Error(`Session ${sessionId} is not active`);
  }

  const now = new Date();

  // Calculate absolute expiration from session creation
  const absoluteExpiresAt = new Date(
    session.createdAt.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  // Check if session has exceeded absolute timeout
  if (now >= absoluteExpiresAt) {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        terminatedAt: now,
        terminationReason: "ABSOLUTE_TIMEOUT",
      },
    });
    throw new Error(`Session ${sessionId} has exceeded absolute timeout`);
  }

  // Get org-specific sliding timeout
  const slidingTimeoutMinutes =
    session.user.organization.sessionTimeoutMinutes ?? SLIDING_TIMEOUT_MINUTES;

  // Calculate new sliding expiration
  const newSlidingExpiresAt = new Date(now.getTime() + slidingTimeoutMinutes * 60 * 1000);

  // Use the earlier of new sliding timeout or absolute timeout
  const newExpiresAt =
    newSlidingExpiresAt < absoluteExpiresAt ? newSlidingExpiresAt : absoluteExpiresAt;

  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      lastActivity: now,
      expiresAt: newExpiresAt,
    },
  });

  console.debug(
    `[Session] Updated activity for session ${sessionId}, new expiration: ${newExpiresAt.toISOString()}`
  );
}

// ============================================
// SESSION STATUS CHECK
// ============================================

/**
 * Get comprehensive session status including both timeout types
 *
 * @param sessionId - The session's database ID
 * @returns Session status with expiration details, or null if not found
 */
export async function getSessionStatus(sessionId: string): Promise<SessionStatus | null> {
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

  if (!session) {
    return null;
  }

  const now = new Date();

  // Calculate absolute expiration from session creation
  const absoluteExpiresAt = new Date(
    session.createdAt.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  // Check if session is not active (manually invalidated)
  if (!session.isActive) {
    return {
      valid: false,
      expiresIn: 0,
      absoluteExpiresIn: 0,
      warningActive: false,
      expiredReason: "invalidated",
    };
  }

  // Check absolute timeout first (takes precedence)
  if (now >= absoluteExpiresAt) {
    // Mark session as expired
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        terminatedAt: now,
        terminationReason: "ABSOLUTE_TIMEOUT",
      },
    });

    return {
      valid: false,
      expiresIn: 0,
      absoluteExpiresIn: 0,
      warningActive: false,
      expiredReason: "absolute",
    };
  }

  // Check sliding timeout
  if (isSessionExpired(session.expiresAt)) {
    // Mark session as expired
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        terminatedAt: now,
        terminationReason: "TIMEOUT",
      },
    });

    return {
      valid: false,
      expiresIn: 0,
      absoluteExpiresIn: getRemainingSeconds(absoluteExpiresAt),
      warningActive: false,
      expiredReason: "sliding",
    };
  }

  // Session is valid - calculate remaining times
  const slidingExpiresIn = getRemainingSeconds(session.expiresAt);
  const absoluteExpiresIn = getRemainingSeconds(absoluteExpiresAt);

  // Warning is active if within WARNING_BEFORE_MINUTES of either timeout
  const warningThresholdSeconds = WARNING_BEFORE_MINUTES * 60;
  const warningActive =
    slidingExpiresIn <= warningThresholdSeconds || absoluteExpiresIn <= warningThresholdSeconds;

  return {
    valid: true,
    expiresIn: slidingExpiresIn,
    absoluteExpiresIn,
    warningActive,
  };
}

// ============================================
// SESSION INVALIDATION
// ============================================

/**
 * Invalidate a session (logout, security event, admin action)
 *
 * @param sessionId - The session's database ID
 * @param reason - Reason for invalidation (for audit trail)
 * @returns void - Does not throw if session not found
 */
export async function invalidateSession(
  sessionId: string,
  reason: string = "USER_LOGOUT"
): Promise<void> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, isActive: true },
  });

  if (!session) {
    console.warn(`[Session] Attempted to invalidate non-existent session ${sessionId}`);
    return;
  }

  if (!session.isActive) {
    console.debug(`[Session] Session ${sessionId} is already inactive`);
    return;
  }

  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminationReason: reason,
    },
  });

  console.info(`[Session] Invalidated session ${sessionId} for user ${session.userId}, reason: ${reason}`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get session by token (for API authentication)
 *
 * @param token - The session token
 * @returns Session status or null if not found/invalid
 */
export async function getSessionByTokenWithStatus(
  token: string
): Promise<{ session: UserSession; status: SessionStatus } | null> {
  const session = await prisma.userSession.findUnique({
    where: { token },
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

  const status = await getSessionStatus(session.id);
  if (!status) {
    return null;
  }

  // Calculate absolute expiration for response
  const absoluteExpiresAt = new Date(
    session.createdAt.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
  );

  return {
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      deviceInfo: session.deviceInfo as UserSession["deviceInfo"],
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      slidingExpiresAt: session.expiresAt,
      absoluteExpiresAt,
      isActive: session.isActive,
    },
    status,
  };
}

/**
 * Find the most recent active session for a user
 *
 * @param userId - The user's database ID
 * @returns Session ID or null if no active session
 */
export async function findActiveSessionForUser(userId: string): Promise<string | null> {
  const session = await prisma.userSession.findFirst({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivity: "desc" },
    select: { id: true },
  });

  return session?.id ?? null;
}

/**
 * Format seconds into human-readable time string
 *
 * @param seconds - Number of seconds
 * @returns Formatted string like "5:30" or "1:05:30"
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
