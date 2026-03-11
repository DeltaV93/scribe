/**
 * Password History Service
 *
 * Tracks password history to prevent reuse of recent passwords.
 * Uses bcrypt for secure password hashing.
 */

import { prisma } from "@/lib/db";
import * as bcrypt from "bcrypt";
import { PASSWORD_POLICY_DEFAULTS } from "./password-policy";

const BCRYPT_ROUNDS = 12;

// ============================================
// TYPES
// ============================================

export interface PasswordHistoryCheckResult {
  isReused: boolean;
  message: string | null;
}

// ============================================
// PASSWORD HISTORY FUNCTIONS
// ============================================

/**
 * Add a password to the user's history
 */
export async function addPasswordToHistory(
  userId: string,
  password: string
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.passwordHistory.create({
    data: {
      userId,
      passwordHash,
    },
  });

  // Clean up old entries beyond the history limit
  await prunePasswordHistory(userId);
}

/**
 * Check if a password has been used recently
 */
export async function checkPasswordHistory(
  userId: string,
  newPassword: string
): Promise<PasswordHistoryCheckResult> {
  const historyEntries = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PASSWORD_POLICY_DEFAULTS.PASSWORD_HISTORY_COUNT,
    select: { passwordHash: true },
  });

  for (const entry of historyEntries) {
    const isMatch = await bcrypt.compare(newPassword, entry.passwordHash);
    if (isMatch) {
      return {
        isReused: true,
        message: `Password cannot be the same as your last ${PASSWORD_POLICY_DEFAULTS.PASSWORD_HISTORY_COUNT} passwords`,
      };
    }
  }

  return {
    isReused: false,
    message: null,
  };
}

/**
 * Remove old password history entries beyond the limit
 */
async function prunePasswordHistory(userId: string): Promise<void> {
  const allEntries = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (allEntries.length > PASSWORD_POLICY_DEFAULTS.PASSWORD_HISTORY_COUNT) {
    const entriesToDelete = allEntries.slice(PASSWORD_POLICY_DEFAULTS.PASSWORD_HISTORY_COUNT);
    const idsToDelete = entriesToDelete.map((e) => e.id);

    await prisma.passwordHistory.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}

/**
 * Clear all password history for a user (admin action)
 */
export async function clearPasswordHistory(userId: string): Promise<void> {
  await prisma.passwordHistory.deleteMany({
    where: { userId },
  });
}

/**
 * Get password history count for a user
 */
export async function getPasswordHistoryCount(userId: string): Promise<number> {
  return prisma.passwordHistory.count({
    where: { userId },
  });
}
