import { prisma } from "@/lib/db";
import type { RateLimitCheckResult } from "./types";

// Rate limit: 3 uploads per session per user per hour
const MAX_UPLOADS_PER_HOUR = 3;
const WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if a user can upload another attendance photo for a session
 */
export async function checkUploadRateLimit(
  userId: string,
  sessionId: string
): Promise<RateLimitCheckResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DURATION_MS);

  // Find or create rate limit record
  const existing = await prisma.attendanceUploadRateLimit.findUnique({
    where: {
      userId_sessionId: {
        userId,
        sessionId,
      },
    },
  });

  if (!existing) {
    // No previous uploads - allowed
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: MAX_UPLOADS_PER_HOUR,
      windowResetAt: new Date(now.getTime() + WINDOW_DURATION_MS),
    };
  }

  // Check if we're in a new window
  if (existing.windowStart < windowStart) {
    // Window expired, reset
    await prisma.attendanceUploadRateLimit.update({
      where: { id: existing.id },
      data: {
        uploadCount: 0,
        windowStart: now,
      },
    });

    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: MAX_UPLOADS_PER_HOUR,
      windowResetAt: new Date(now.getTime() + WINDOW_DURATION_MS),
    };
  }

  // We're in the same window - check count
  const allowed = existing.uploadCount < MAX_UPLOADS_PER_HOUR;
  const windowResetAt = new Date(existing.windowStart.getTime() + WINDOW_DURATION_MS);

  return {
    allowed,
    currentCount: existing.uploadCount,
    maxAllowed: MAX_UPLOADS_PER_HOUR,
    windowResetAt,
  };
}

/**
 * Record an upload for rate limiting
 */
export async function recordUploadForRateLimit(
  userId: string,
  sessionId: string
): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DURATION_MS);

  await prisma.attendanceUploadRateLimit.upsert({
    where: {
      userId_sessionId: {
        userId,
        sessionId,
      },
    },
    create: {
      userId,
      sessionId,
      uploadCount: 1,
      windowStart: now,
    },
    update: {
      uploadCount: {
        increment: 1,
      },
      // Reset window if it's expired
      windowStart: {
        set: await prisma.attendanceUploadRateLimit
          .findUnique({
            where: {
              userId_sessionId: {
                userId,
                sessionId,
              },
            },
            select: { windowStart: true },
          })
          .then((record) =>
            record && record.windowStart >= windowStart ? record.windowStart : now
          ),
      },
    },
  });
}

/**
 * Get rate limit status for a user/session
 */
export async function getRateLimitStatus(
  userId: string,
  sessionId: string
): Promise<{
  uploadCount: number;
  windowStart: Date;
  windowEnd: Date;
  remaining: number;
}> {
  const record = await prisma.attendanceUploadRateLimit.findUnique({
    where: {
      userId_sessionId: {
        userId,
        sessionId,
      },
    },
  });

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DURATION_MS);

  if (!record || record.windowStart < windowStart) {
    // No record or expired window
    return {
      uploadCount: 0,
      windowStart: now,
      windowEnd: new Date(now.getTime() + WINDOW_DURATION_MS),
      remaining: MAX_UPLOADS_PER_HOUR,
    };
  }

  return {
    uploadCount: record.uploadCount,
    windowStart: record.windowStart,
    windowEnd: new Date(record.windowStart.getTime() + WINDOW_DURATION_MS),
    remaining: Math.max(0, MAX_UPLOADS_PER_HOUR - record.uploadCount),
  };
}

/**
 * Clean up old rate limit records (run periodically)
 */
export async function cleanupOldRateLimitRecords(): Promise<number> {
  const cutoff = new Date(Date.now() - WINDOW_DURATION_MS * 24); // 24 hours old

  const result = await prisma.attendanceUploadRateLimit.deleteMany({
    where: {
      windowStart: {
        lt: cutoff,
      },
    },
  });

  return result.count;
}
