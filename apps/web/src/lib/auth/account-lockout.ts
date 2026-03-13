/**
 * Account Lockout Service
 *
 * Implements account lockout after failed login attempts.
 * HIPAA-compliant with configurable lockout duration.
 */

import { prisma } from "@/lib/db";

// ============================================
// CONFIGURATION
// ============================================

export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 30,
} as const;

// ============================================
// TYPES
// ============================================

export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  minutesRemaining: number | null;
}

// ============================================
// LOCKOUT FUNCTIONS
// ============================================

/**
 * Get the current lockout status for a user
 */
export async function getLockoutStatus(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const failedAttempts = user.failedLoginAttempts ?? 0;
  const lockedUntil = user.lockedUntil ?? null;

  const now = new Date();
  const isLocked = lockedUntil !== null && lockedUntil > now;

  let minutesRemaining: number | null = null;
  if (isLocked && lockedUntil) {
    minutesRemaining = Math.ceil(
      (lockedUntil.getTime() - now.getTime()) / (1000 * 60)
    );
  }

  return {
    isLocked,
    failedAttempts,
    lockedUntil,
    minutesRemaining,
  };
}

/**
 * Check if a user account is currently locked
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const status = await getLockoutStatus(userId);
  return status.isLocked;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLoginAttempt(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if currently locked and lock hasn't expired
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    return getLockoutStatus(userId);
  }

  // Increment failed attempts (or reset if lock expired)
  const currentAttempts = user.failedLoginAttempts ?? 0;
  const newFailedAttempts = (user.lockedUntil && user.lockedUntil <= now)
    ? 1
    : currentAttempts + 1;

  // Check if we should lock the account
  let lockedUntil: Date | null = null;
  if (newFailedAttempts >= LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_CONFIG.LOCKOUT_DURATION_MINUTES);

    // TODO: Send lockout notification email when email service is available
    console.log(`Account locked for user ${user.email} until ${lockedUntil.toISOString()}`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newFailedAttempts,
      lockedUntil,
    },
  });

  return getLockoutStatus(userId);
}

/**
 * Clear failed login attempts after successful login
 */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Admin function to unlock a user account
 */
export async function unlockAccount(
  userId: string,
  adminId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, orgId: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Log the admin action
  await prisma.auditLog.create({
    data: {
      orgId: user.orgId,
      userId: adminId,
      action: "UNLOCK_ACCOUNT",
      resource: "USER",
      resourceId: userId,
      resourceName: user.email,
      details: {
        unlockedUserId: userId,
        unlockedUserEmail: user.email,
      },
      previousHash: "",
      hash: "",
    },
  });

  // TODO: Notify user their account was unlocked
  console.log(`Account unlocked for user ${user.email} by admin ${adminId}`);
}

/**
 * Get locked accounts in an organization
 */
export async function getLockedAccounts(
  orgId: string
): Promise<Array<{ id: string; email: string; name: string | null; lockedUntil: Date; failedAttempts: number }>> {
  const now = new Date();

  // Query users with lockout - filter directly in DB for efficiency
  const users = await prisma.user.findMany({
    where: {
      orgId,
      lockedUntil: { gt: now },
    },
    select: {
      id: true,
      email: true,
      name: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    lockedUntil: user.lockedUntil!,
    failedAttempts: user.failedLoginAttempts ?? 0,
  }));
}
