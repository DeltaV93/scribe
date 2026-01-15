import { prisma } from "@/lib/db";

/**
 * Resource Locking Service
 *
 * Provides optimistic locking for resources like form submissions and client records
 * to prevent concurrent editing conflicts.
 */

// Lock configuration
export const LOCK_CONFIG = {
  // Default lock expiration (5 minutes)
  defaultExpirationMs: 5 * 60 * 1000,
  // Maximum lock extension time
  maxExtensionMs: 30 * 60 * 1000,
  // Heartbeat interval for extending locks
  heartbeatIntervalMs: 60 * 1000,
};

export type LockableResourceType = "form_submission" | "client" | "form" | "call";

export interface ResourceLock {
  id: string;
  resourceType: string;
  resourceId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface LockResult {
  success: boolean;
  lock?: ResourceLock;
  existingLock?: {
    lockedBy: string;
    userName?: string;
    lockedAt: Date;
    expiresAt: Date;
  };
  error?: string;
}

/**
 * Attempt to acquire a lock on a resource
 */
export async function acquireLock(
  resourceType: LockableResourceType,
  resourceId: string,
  userId: string,
  expirationMs: number = LOCK_CONFIG.defaultExpirationMs
): Promise<LockResult> {
  const expiresAt = new Date(Date.now() + expirationMs);

  try {
    // First, clean up expired locks
    await prisma.resourceLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    // Check for existing lock
    const existingLock = await prisma.resourceLock.findUnique({
      where: {
        resourceType_resourceId: {
          resourceType,
          resourceId,
        },
      },
    });

    if (existingLock) {
      // If lock belongs to this user, extend it
      if (existingLock.lockedBy === userId) {
        const updated = await prisma.resourceLock.update({
          where: { id: existingLock.id },
          data: { expiresAt },
        });

        return {
          success: true,
          lock: updated,
        };
      }

      // Lock belongs to another user
      const lockOwner = await prisma.user.findUnique({
        where: { id: existingLock.lockedBy },
        select: { name: true },
      });

      return {
        success: false,
        existingLock: {
          lockedBy: existingLock.lockedBy,
          userName: lockOwner?.name || undefined,
          lockedAt: existingLock.lockedAt,
          expiresAt: existingLock.expiresAt,
        },
        error: `Resource is currently locked by ${lockOwner?.name || "another user"}`,
      };
    }

    // No existing lock, create new one
    const lock = await prisma.resourceLock.create({
      data: {
        resourceType,
        resourceId,
        lockedBy: userId,
        expiresAt,
      },
    });

    return {
      success: true,
      lock,
    };
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if ((error as { code?: string }).code === "P2002") {
      // Another user acquired the lock between our check and create
      const existingLock = await prisma.resourceLock.findUnique({
        where: {
          resourceType_resourceId: {
            resourceType,
            resourceId,
          },
        },
      });

      if (existingLock) {
        const lockOwner = await prisma.user.findUnique({
          where: { id: existingLock.lockedBy },
          select: { name: true },
        });

        return {
          success: false,
          existingLock: {
            lockedBy: existingLock.lockedBy,
            userName: lockOwner?.name || undefined,
            lockedAt: existingLock.lockedAt,
            expiresAt: existingLock.expiresAt,
          },
          error: `Resource was just locked by ${lockOwner?.name || "another user"}`,
        };
      }
    }

    console.error("Error acquiring lock:", error);
    return {
      success: false,
      error: "Failed to acquire lock",
    };
  }
}

/**
 * Release a lock on a resource
 */
export async function releaseLock(
  resourceType: LockableResourceType,
  resourceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const lock = await prisma.resourceLock.findUnique({
      where: {
        resourceType_resourceId: {
          resourceType,
          resourceId,
        },
      },
    });

    if (!lock) {
      // No lock exists, nothing to release
      return { success: true };
    }

    if (lock.lockedBy !== userId) {
      return {
        success: false,
        error: "You do not own this lock",
      };
    }

    await prisma.resourceLock.delete({
      where: { id: lock.id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error releasing lock:", error);
    return {
      success: false,
      error: "Failed to release lock",
    };
  }
}

/**
 * Extend (heartbeat) an existing lock
 */
export async function extendLock(
  resourceType: LockableResourceType,
  resourceId: string,
  userId: string,
  extensionMs: number = LOCK_CONFIG.defaultExpirationMs
): Promise<LockResult> {
  try {
    const lock = await prisma.resourceLock.findUnique({
      where: {
        resourceType_resourceId: {
          resourceType,
          resourceId,
        },
      },
    });

    if (!lock) {
      return {
        success: false,
        error: "Lock not found",
      };
    }

    if (lock.lockedBy !== userId) {
      return {
        success: false,
        error: "You do not own this lock",
      };
    }

    // Calculate new expiration, capped at max
    const now = Date.now();
    const maxExpiration = now + LOCK_CONFIG.maxExtensionMs;
    const requestedExpiration = now + extensionMs;
    const newExpiration = new Date(Math.min(requestedExpiration, maxExpiration));

    const updated = await prisma.resourceLock.update({
      where: { id: lock.id },
      data: { expiresAt: newExpiration },
    });

    return {
      success: true,
      lock: updated,
    };
  } catch (error) {
    console.error("Error extending lock:", error);
    return {
      success: false,
      error: "Failed to extend lock",
    };
  }
}

/**
 * Check if a resource is locked
 */
export async function checkLock(
  resourceType: LockableResourceType,
  resourceId: string
): Promise<{ locked: boolean; lock?: ResourceLock; userName?: string }> {
  try {
    // Clean up expired locks first
    await prisma.resourceLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    const lock = await prisma.resourceLock.findUnique({
      where: {
        resourceType_resourceId: {
          resourceType,
          resourceId,
        },
      },
    });

    if (!lock) {
      return { locked: false };
    }

    const lockOwner = await prisma.user.findUnique({
      where: { id: lock.lockedBy },
      select: { name: true },
    });

    return {
      locked: true,
      lock,
      userName: lockOwner?.name || undefined,
    };
  } catch (error) {
    console.error("Error checking lock:", error);
    return { locked: false };
  }
}

/**
 * Force release all locks for a user (useful for cleanup on logout)
 */
export async function releaseAllUserLocks(userId: string): Promise<number> {
  try {
    const result = await prisma.resourceLock.deleteMany({
      where: { lockedBy: userId },
    });
    return result.count;
  } catch (error) {
    console.error("Error releasing user locks:", error);
    return 0;
  }
}

/**
 * Clean up expired locks (for scheduled jobs)
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const result = await prisma.resourceLock.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch (error) {
    console.error("Error cleaning up locks:", error);
    return 0;
  }
}
