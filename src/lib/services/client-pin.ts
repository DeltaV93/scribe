import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

// ============================================
// CONFIGURATION
// ============================================

// bcrypt salt rounds (10 is a good balance of security and speed)
const SALT_ROUNDS = 10;

// Maximum failed attempts before lockout
const MAX_ATTEMPTS = 5;

// Lockout duration in minutes
const LOCKOUT_MINUTES = 15;

// PIN format: 4 digits
const PIN_REGEX = /^\d{4}$/;

// ============================================
// TYPES
// ============================================

export interface PINVerifyResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: Date;
}

// ============================================
// PIN VALIDATION
// ============================================

/**
 * Validate PIN format (4 digits)
 */
export function isValidPINFormat(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

// ============================================
// PIN MANAGEMENT
// ============================================

/**
 * Set or update a client's PIN
 */
export async function setPIN(clientId: string, pin: string): Promise<void> {
  // Validate format
  if (!isValidPINFormat(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }

  // Verify client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, deletedAt: true },
  });

  if (!client || client.deletedAt) {
    throw new Error("Client not found");
  }

  // Hash the PIN
  const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

  // Upsert the PIN record
  await prisma.clientPIN.upsert({
    where: { clientId },
    create: {
      clientId,
      pinHash,
      failedAttempts: 0,
      lockedUntil: null,
    },
    update: {
      pinHash,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Verify a client's PIN
 */
export async function verifyPIN(
  clientId: string,
  pin: string
): Promise<PINVerifyResult> {
  // Get the PIN record
  const clientPIN = await prisma.clientPIN.findUnique({
    where: { clientId },
  });

  if (!clientPIN) {
    return {
      success: false,
      error: "PIN not set for this account",
    };
  }

  // Check if currently locked out
  if (clientPIN.lockedUntil && clientPIN.lockedUntil > new Date()) {
    return {
      success: false,
      error: "Account is temporarily locked due to too many failed attempts",
      lockedUntil: clientPIN.lockedUntil,
    };
  }

  // Clear lockout if it has expired
  if (clientPIN.lockedUntil && clientPIN.lockedUntil <= new Date()) {
    await prisma.clientPIN.update({
      where: { clientId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    clientPIN.failedAttempts = 0;
  }

  // Verify the PIN
  const isValid = await bcrypt.compare(pin, clientPIN.pinHash);

  if (isValid) {
    // Reset failed attempts on successful verification
    await prisma.clientPIN.update({
      where: { clientId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    return { success: true };
  }

  // Increment failed attempts
  const newFailedAttempts = clientPIN.failedAttempts + 1;
  const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;

  // Check if should lock out
  if (newFailedAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_MINUTES);

    await prisma.clientPIN.update({
      where: { clientId },
      data: {
        failedAttempts: newFailedAttempts,
        lockedUntil,
      },
    });

    return {
      success: false,
      error: "Account locked due to too many failed attempts",
      lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Update failed attempts
  await prisma.clientPIN.update({
    where: { clientId },
    data: {
      failedAttempts: newFailedAttempts,
    },
  });

  return {
    success: false,
    error: "Incorrect PIN",
    remainingAttempts,
  };
}

/**
 * Remove a client's PIN
 */
export async function removePIN(clientId: string): Promise<boolean> {
  try {
    await prisma.clientPIN.delete({
      where: { clientId },
    });
    return true;
  } catch {
    // PIN might not exist
    return false;
  }
}

/**
 * Check if a client has a PIN set
 */
export async function hasPIN(clientId: string): Promise<boolean> {
  const count = await prisma.clientPIN.count({
    where: { clientId },
  });
  return count > 0;
}

/**
 * Check if a client is currently locked out
 */
export async function isLockedOut(clientId: string): Promise<{
  locked: boolean;
  lockedUntil?: Date;
}> {
  const clientPIN = await prisma.clientPIN.findUnique({
    where: { clientId },
    select: { lockedUntil: true },
  });

  if (!clientPIN || !clientPIN.lockedUntil) {
    return { locked: false };
  }

  if (clientPIN.lockedUntil > new Date()) {
    return {
      locked: true,
      lockedUntil: clientPIN.lockedUntil,
    };
  }

  return { locked: false };
}

/**
 * Get remaining attempts for a client
 */
export async function getRemainingAttempts(clientId: string): Promise<number> {
  const clientPIN = await prisma.clientPIN.findUnique({
    where: { clientId },
    select: { failedAttempts: true, lockedUntil: true },
  });

  if (!clientPIN) {
    return MAX_ATTEMPTS;
  }

  // If locked, return 0
  if (clientPIN.lockedUntil && clientPIN.lockedUntil > new Date()) {
    return 0;
  }

  return Math.max(0, MAX_ATTEMPTS - clientPIN.failedAttempts);
}
