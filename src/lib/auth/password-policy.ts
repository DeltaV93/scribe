/**
 * Password Policy Service
 *
 * Enforces HIPAA-compliant password policies including:
 * - Complexity requirements
 * - Password expiration
 * - Common password checking
 * - Organization-configurable expiration days
 */

import { prisma } from "@/lib/db";
import { z } from "zod";

// ============================================
// CONFIGURATION
// ============================================

export const PASSWORD_POLICY_DEFAULTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  DEFAULT_EXPIRATION_DAYS: 90,
  MIN_EXPIRATION_DAYS: 30,
  MAX_EXPIRATION_DAYS: 180,
  EXPIRATION_WARNING_DAYS: 14,
  PASSWORD_HISTORY_COUNT: 12,
} as const;

const SPECIAL_CHARACTERS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';

// Common passwords list (subset - in production, load from file)
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123",
  "monkey", "1234567", "letmein", "trustno1", "dragon",
  "baseball", "iloveyou", "master", "sunshine", "ashley",
  "bailey", "passw0rd", "shadow", "123123", "654321",
  "superman", "qazwsx", "michael", "football", "password1",
  "password123", "batman", "login", "admin", "welcome",
  "welcome1", "welcome123", "hello", "charlie", "donald",
  "starwars", "princess", "summer", "secret", "access",
  "qwerty123", "mustang", "photoshop", "adobe123", "jennifer",
  "joshua", "google", "freedom", "whatever", "maggie",
  "nicole", "tigger", "buster", "pepper", "ranger",
  "harley", "killer", "purple", "hockey", "george",
  "andrew", "matthew", "jessica", "brandon", "computer",
  "asdfgh", "zxcvbn", "111111", "000000", "121212",
  "696969", "7777777", "1q2w3e", "1q2w3e4r", "1qaz2wsx",
  "password!", "password1!", "welcome!", "admin!", "login!",
  "test123", "test1234", "testing", "testing1", "testing123",
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890",
  "company", "company1", "company123", "corporate",
]);

// ============================================
// TYPES
// ============================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: "weak" | "fair" | "good" | "strong";
}

export interface PasswordExpirationStatus {
  isExpired: boolean;
  daysUntilExpiry: number | null;
  needsWarning: boolean;
  expirationDate: Date | null;
  passwordChangedAt: Date | null;
}

// ============================================
// ZOD SCHEMA
// ============================================

export const passwordSchema = z.string()
  .min(PASSWORD_POLICY_DEFAULTS.MIN_LENGTH,
    `Password must be at least ${PASSWORD_POLICY_DEFAULTS.MIN_LENGTH} characters`)
  .max(PASSWORD_POLICY_DEFAULTS.MAX_LENGTH,
    `Password must be at most ${PASSWORD_POLICY_DEFAULTS.MAX_LENGTH} characters`)
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter"
  )
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain at least one lowercase letter"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one number"
  )
  .refine(
    (password) => new RegExp(`[${SPECIAL_CHARACTERS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password),
    "Password must contain at least one special character"
  );

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (password.length < PASSWORD_POLICY_DEFAULTS.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_POLICY_DEFAULTS.MIN_LENGTH} characters`);
  }

  if (password.length > PASSWORD_POLICY_DEFAULTS.MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_POLICY_DEFAULTS.MAX_LENGTH} characters`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  const specialRegex = new RegExp(`[${SPECIAL_CHARACTERS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
  if (!specialRegex.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  if (isCommonPassword(password)) {
    errors.push("This password is too common. Please choose a more unique password");
  }

  if (hasSequentialChars(password, 4)) {
    warnings.push("Password contains sequential characters");
  }

  if (hasRepeatingChars(password, 3)) {
    warnings.push("Password contains repeating characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    strength: calculatePasswordStrength(password, errors.length),
  };
}

export function isCommonPassword(password: string): boolean {
  const lowercasePassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowercasePassword)) return true;

  const normalizedPassword = lowercasePassword
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/@/g, 'a').replace(/\$/g, 's').replace(/!/g, 'i');

  return COMMON_PASSWORDS.has(normalizedPassword);
}

function hasSequentialChars(password: string, minLength: number): boolean {
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const lowercasePassword = password.toLowerCase();

  for (const sequence of sequences) {
    for (let i = 0; i <= sequence.length - minLength; i++) {
      const forward = sequence.slice(i, i + minLength);
      const backward = forward.split('').reverse().join('');
      if (lowercasePassword.includes(forward) || lowercasePassword.includes(backward)) {
        return true;
      }
    }
  }
  return false;
}

function hasRepeatingChars(password: string, minLength: number): boolean {
  return new RegExp(`(.)\\1{${minLength - 1},}`).test(password);
}

function calculatePasswordStrength(password: string, errorCount: number): "weak" | "fair" | "good" | "strong" {
  if (errorCount > 0) return "weak";

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  if (!hasSequentialChars(password, 3)) score += 1;
  if (!hasRepeatingChars(password, 2)) score += 1;

  if (score >= 8) return "strong";
  if (score >= 6) return "good";
  if (score >= 4) return "fair";
  return "weak";
}

// ============================================
// EXPIRATION FUNCTIONS
// ============================================

export async function getOrgPasswordExpirationDays(orgId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  const settings = org?.settings as Record<string, unknown>;
  const expirationDays = settings?.passwordExpirationDays as number | undefined;

  if (typeof expirationDays === 'number' &&
      expirationDays >= PASSWORD_POLICY_DEFAULTS.MIN_EXPIRATION_DAYS &&
      expirationDays <= PASSWORD_POLICY_DEFAULTS.MAX_EXPIRATION_DAYS) {
    return expirationDays;
  }

  return PASSWORD_POLICY_DEFAULTS.DEFAULT_EXPIRATION_DAYS;
}

export async function setOrgPasswordExpirationDays(orgId: string, days: number): Promise<void> {
  if (days < PASSWORD_POLICY_DEFAULTS.MIN_EXPIRATION_DAYS ||
      days > PASSWORD_POLICY_DEFAULTS.MAX_EXPIRATION_DAYS) {
    throw new Error(`Password expiration days must be between ${PASSWORD_POLICY_DEFAULTS.MIN_EXPIRATION_DAYS} and ${PASSWORD_POLICY_DEFAULTS.MAX_EXPIRATION_DAYS}`);
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  if (!org) throw new Error("Organization not found");

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      settings: {
        ...(org.settings as Record<string, unknown> || {}),
        passwordExpirationDays: days,
      },
    },
  });
}

export async function checkPasswordExpiration(userId: string): Promise<PasswordExpirationStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordChangedAt: true,
      orgId: true
    },
  });

  if (!user) throw new Error("User not found");

  // Handle users without passwordChangedAt field (use null check)
  const passwordChangedAt = (user as { passwordChangedAt?: Date | null }).passwordChangedAt;

  if (!passwordChangedAt) {
    return {
      isExpired: true,
      daysUntilExpiry: null,
      needsWarning: true,
      expirationDate: null,
      passwordChangedAt: null,
    };
  }

  const expirationDays = await getOrgPasswordExpirationDays(user.orgId);
  const expirationDate = new Date(passwordChangedAt);
  expirationDate.setDate(expirationDate.getDate() + expirationDays);

  const daysUntilExpiry = Math.ceil(
    (expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    isExpired: daysUntilExpiry <= 0,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
    needsWarning: daysUntilExpiry <= PASSWORD_POLICY_DEFAULTS.EXPIRATION_WARNING_DAYS && daysUntilExpiry > 0,
    expirationDate,
    passwordChangedAt,
  };
}

export async function forcePasswordChange(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { mustChangePassword: true } as Record<string, unknown>,
  });
}

export async function recordPasswordChange(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    } as Record<string, unknown>,
  });
}

export async function mustChangePassword(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  // Check for mustChangePassword field if it exists
  const userWithField = user as { mustChangePassword?: boolean } | null;
  return userWithField?.mustChangePassword ?? false;
}

export async function getUsersWithExpiringPasswords(
  orgId: string,
  warningDays: number = PASSWORD_POLICY_DEFAULTS.EXPIRATION_WARNING_DAYS
): Promise<Array<{ id: string; email: string; name: string | null; daysUntilExpiry: number }>> {
  const expirationDays = await getOrgPasswordExpirationDays(orgId);
  const warningThreshold = new Date();
  warningThreshold.setDate(warningThreshold.getDate() + warningDays - expirationDays);

  const users = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });

  // Filter users with passwordChangedAt in the warning window
  const results: Array<{ id: string; email: string; name: string | null; daysUntilExpiry: number }> = [];

  for (const user of users) {
    const userWithPwd = user as { id: string; email: string; name: string | null; passwordChangedAt?: Date | null };
    if (!userWithPwd.passwordChangedAt) continue;

    const expDate = new Date(userWithPwd.passwordChangedAt);
    expDate.setDate(expDate.getDate() + expirationDays);
    const daysUntilExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry > 0 && daysUntilExpiry <= warningDays) {
      results.push({
        id: user.id,
        email: user.email,
        name: user.name,
        daysUntilExpiry: Math.max(0, daysUntilExpiry),
      });
    }
  }

  return results;
}
