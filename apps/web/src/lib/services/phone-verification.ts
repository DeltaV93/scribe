import { prisma } from "@/lib/db";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { deleteClientSessions } from "./portal-sessions";

// ============================================
// CONFIGURATION
// ============================================

// Verification code expiry in minutes
const VERIFICATION_EXPIRY_MINUTES = 10;

// Maximum verification attempts
const MAX_VERIFICATION_ATTEMPTS = 3;

// bcrypt salt rounds for code hashing
const SALT_ROUNDS = 10;

// Phone format regex (basic E.164 or 10-digit)
const PHONE_REGEX = /^(\+1)?\d{10}$/;

// ============================================
// TYPES
// ============================================

export interface InitiateVerificationResult {
  verificationId: string;
  expiresAt: Date;
  phoneNumber: string;
}

export interface VerifyCodeResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  // Generate a random 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  return code;
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // If 10 digits, add +1 prefix
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If 11 digits starting with 1, add + prefix
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Return as-is if already in E.164 format
  if (phone.startsWith("+")) {
    return phone;
  }

  return `+${digits}`;
}

/**
 * Validate phone number format
 */
export function isValidPhoneFormat(phone: string): boolean {
  const normalized = phone.replace(/\D/g, "");
  return normalized.length === 10 || (normalized.length === 11 && normalized.startsWith("1"));
}

// ============================================
// VERIFICATION FLOW
// ============================================

/**
 * Initiate a phone number change verification
 * Generates a code and sends via SMS
 */
export async function initiatePhoneChange(
  clientId: string,
  newPhone: string
): Promise<InitiateVerificationResult> {
  // Validate phone format
  if (!isValidPhoneFormat(newPhone)) {
    throw new Error("Invalid phone number format");
  }

  const normalizedPhone = normalizePhoneNumber(newPhone);

  // Verify client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, phone: true, deletedAt: true, orgId: true },
  });

  if (!client || client.deletedAt) {
    throw new Error("Client not found");
  }

  // Check if new phone is same as current
  if (normalizePhoneNumber(client.phone) === normalizedPhone) {
    throw new Error("New phone number must be different from current");
  }

  // Check if phone is already used by another client in the same org
  const existingClient = await prisma.client.findFirst({
    where: {
      orgId: client.orgId,
      phone: newPhone.replace(/\D/g, "").slice(-10), // Store as 10 digits
      id: { not: clientId },
      deletedAt: null,
    },
  });

  if (existingClient) {
    throw new Error("This phone number is already associated with another account");
  }

  // Generate verification code
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + VERIFICATION_EXPIRY_MINUTES);

  // Delete any existing pending verifications for this client
  await prisma.phoneVerification.deleteMany({
    where: {
      clientId,
      verifiedAt: null,
    },
  });

  // Create new verification record
  const verification = await prisma.phoneVerification.create({
    data: {
      clientId,
      phoneNumber: normalizedPhone,
      codeHash,
      expiresAt,
      attempts: 0,
    },
  });

  // Send SMS with verification code
  // Note: This should integrate with the SMS notification service
  await sendVerificationSMS(normalizedPhone, code);

  return {
    verificationId: verification.id,
    expiresAt: verification.expiresAt,
    phoneNumber: normalizedPhone,
  };
}

/**
 * Verify the phone change code
 * On success, updates the client's phone and invalidates all sessions
 */
export async function verifyPhoneChange(
  clientId: string,
  verificationId: string,
  code: string
): Promise<VerifyCodeResult> {
  // Get verification record
  const verification = await prisma.phoneVerification.findFirst({
    where: {
      id: verificationId,
      clientId,
      verifiedAt: null,
    },
  });

  if (!verification) {
    return {
      success: false,
      error: "Verification not found or already completed",
    };
  }

  // Check if expired
  if (verification.expiresAt < new Date()) {
    // Clean up expired verification
    await prisma.phoneVerification.delete({
      where: { id: verificationId },
    });

    return {
      success: false,
      error: "Verification code has expired",
    };
  }

  // Check max attempts
  if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    await prisma.phoneVerification.delete({
      where: { id: verificationId },
    });

    return {
      success: false,
      error: "Too many failed attempts. Please request a new code.",
    };
  }

  // Verify the code
  const isValid = await bcrypt.compare(code, verification.codeHash);

  if (!isValid) {
    // Increment attempts
    const newAttempts = verification.attempts + 1;
    await prisma.phoneVerification.update({
      where: { id: verificationId },
      data: { attempts: newAttempts },
    });

    const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - newAttempts;

    if (remainingAttempts <= 0) {
      await prisma.phoneVerification.delete({
        where: { id: verificationId },
      });

      return {
        success: false,
        error: "Too many failed attempts. Please request a new code.",
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      error: "Incorrect verification code",
      remainingAttempts,
    };
  }

  // Code is valid - update client's phone number
  const newPhone = verification.phoneNumber.replace(/\D/g, "").slice(-10);

  await prisma.$transaction(async (tx) => {
    // Update client phone
    await tx.client.update({
      where: { id: clientId },
      data: { phone: newPhone },
    });

    // Update SMS preference if exists
    await tx.smsPreference.updateMany({
      where: { clientId },
      data: { phoneNumber: verification.phoneNumber },
    });

    // Mark verification as complete
    await tx.phoneVerification.update({
      where: { id: verificationId },
      data: { verifiedAt: new Date() },
    });
  });

  // Invalidate all existing sessions (security measure)
  await deleteClientSessions(clientId);

  return { success: true };
}

// ============================================
// SMS INTEGRATION
// ============================================

/**
 * Send verification SMS
 * This is a placeholder - should integrate with the actual SMS service
 */
async function sendVerificationSMS(phoneNumber: string, code: string): Promise<void> {
  // Import the SMS notification service dynamically to avoid circular deps
  const { sendSms } = await import("./sms-notifications");

  const message = `Your Scrybe verification code is: ${code}. This code expires in ${VERIFICATION_EXPIRY_MINUTES} minutes.`;

  try {
    await sendSms(phoneNumber, message);
  } catch (error) {
    console.error("Failed to send verification SMS:", error);
    throw new Error("Failed to send verification code. Please try again.");
  }
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired phone verifications
 * Should be run periodically via cron job
 */
export async function cleanupExpiredVerifications(): Promise<number> {
  const result = await prisma.phoneVerification.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      verifiedAt: null,
    },
  });
  return result.count;
}

/**
 * Get count of expired verifications (for monitoring)
 */
export async function getExpiredVerificationCount(): Promise<number> {
  return prisma.phoneVerification.count({
    where: {
      expiresAt: { lt: new Date() },
      verifiedAt: null,
    },
  });
}

/**
 * Cancel a pending verification
 */
export async function cancelVerification(
  clientId: string,
  verificationId: string
): Promise<boolean> {
  try {
    await prisma.phoneVerification.delete({
      where: {
        id: verificationId,
        clientId,
        verifiedAt: null,
      },
    });
    return true;
  } catch {
    return false;
  }
}
