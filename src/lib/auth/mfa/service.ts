/**
 * MFA Service
 *
 * Coordinates MFA operations including setup, verification, and management.
 * Handles enforcement rules based on user roles and organization settings.
 */

import { prisma } from "@/lib/db";
import { UserRole } from "@/types";
import { createAuditLog } from "@/lib/audit/service";
import {
  initializeTOTPSetup,
  verifyEncryptedTOTP,
  encryptSecret,
  type TOTPSetupData,
} from "./totp";
import {
  generateBackupCodes,
  consumeBackupCode,
  markCodeAsUsed,
  countRemainingCodes,
  formatCodesForDisplay,
  type BackupCodesResult,
} from "./backup-codes";

// Roles that require MFA by default
const MFA_REQUIRED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.PROGRAM_MANAGER];

export interface MFASetupResult {
  success: boolean;
  setupData?: TOTPSetupData;
  error?: string;
}

export interface MFAEnableResult {
  success: boolean;
  backupCodes?: string[];
  error?: string;
}

export interface MFAVerifyResult {
  success: boolean;
  usedBackupCode?: boolean;
  remainingBackupCodes?: number;
  error?: string;
}

export interface MFAStatusResult {
  mfaEnabled: boolean;
  mfaRequired: boolean;
  mfaLastUsed: Date | null;
  backupCodesRemaining: number;
  requiresSetup: boolean;
}

/**
 * Check if MFA is required for a user based on role and org settings
 */
export async function isMFARequired(
  userId: string
): Promise<{ required: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: {
        select: {
          requireMfa: true,
        },
      },
    },
  });

  if (!user) {
    return { required: false };
  }

  // Check organization-wide requirement
  if (user.organization.requireMfa) {
    return { required: true, reason: "Organization requires MFA for all users" };
  }

  // Check role-based requirement
  if (MFA_REQUIRED_ROLES.includes(user.role as UserRole)) {
    return { required: true, reason: `MFA is required for ${user.role} role` };
  }

  return { required: false };
}

/**
 * Get MFA status for a user
 */
export async function getMFAStatus(userId: string): Promise<MFAStatusResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaEnabled: true,
      mfaLastUsed: true,
      mfaBackupCodes: true,
      role: true,
      organization: {
        select: {
          requireMfa: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { required } = await isMFARequired(userId);

  return {
    mfaEnabled: user.mfaEnabled,
    mfaRequired: required,
    mfaLastUsed: user.mfaLastUsed,
    backupCodesRemaining: countRemainingCodes(user.mfaBackupCodes),
    requiresSetup: required && !user.mfaEnabled,
  };
}

/**
 * Initialize MFA setup for a user
 * Returns QR code and setup data
 */
export async function initializeMFASetup(
  userId: string
): Promise<MFASetupResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      mfaEnabled: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.mfaEnabled) {
    return { success: false, error: "MFA is already enabled" };
  }

  try {
    const setupData = await initializeTOTPSetup(user.email);
    return { success: true, setupData };
  } catch (error) {
    console.error("Failed to initialize MFA setup:", error);
    return { success: false, error: "Failed to initialize MFA setup" };
  }
}

/**
 * Enable MFA for a user after verifying the setup code
 * Returns backup codes (only shown once)
 */
export async function enableMFA(
  userId: string,
  secret: string,
  verificationCode: string
): Promise<MFAEnableResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      orgId: true,
      mfaEnabled: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.mfaEnabled) {
    return { success: false, error: "MFA is already enabled" };
  }

  // Import totp functions for verification
  const { verifyTOTP } = await import("./totp");

  // Verify the code with the provided secret
  if (!(await verifyTOTP(secret, verificationCode))) {
    return { success: false, error: "Invalid verification code" };
  }

  // Generate backup codes
  const backupCodesResult: BackupCodesResult = await generateBackupCodes();
  const encryptedSecret = encryptSecret(secret);

  // Update user with MFA settings
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
      mfaBackupCodes: backupCodesResult.hashedCodes,
      mfaEnabledAt: new Date(),
    },
  });

  // Audit log
  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "UPDATE",
    resource: "USER",
    resourceId: user.id,
    resourceName: user.email,
    details: { event: "MFA_ENABLED" },
  });

  return {
    success: true,
    backupCodes: formatCodesForDisplay(backupCodesResult.plainTextCodes),
  };
}

/**
 * Verify MFA code (TOTP or backup code)
 */
export async function verifyMFA(
  userId: string,
  code: string
): Promise<MFAVerifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      orgId: true,
      email: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    return { success: false, error: "MFA is not enabled for this user" };
  }

  // First try TOTP verification
  if (await verifyEncryptedTOTP(user.mfaSecret, code)) {
    // Update last used timestamp
    await prisma.user.update({
      where: { id: userId },
      data: { mfaLastUsed: new Date() },
    });

    return {
      success: true,
      usedBackupCode: false,
      remainingBackupCodes: countRemainingCodes(user.mfaBackupCodes),
    };
  }

  // Try backup code verification
  const backupCodeIndex = await consumeBackupCode(code, user.mfaBackupCodes);

  if (backupCodeIndex >= 0) {
    // Mark backup code as used
    const updatedCodes = markCodeAsUsed(user.mfaBackupCodes, backupCodeIndex);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: updatedCodes,
        mfaLastUsed: new Date(),
      },
    });

    // Audit log for backup code usage
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "USER",
      resourceId: user.id,
      resourceName: user.email,
      details: {
        event: "MFA_BACKUP_CODE_USED",
        remainingCodes: countRemainingCodes(updatedCodes),
      },
    });

    return {
      success: true,
      usedBackupCode: true,
      remainingBackupCodes: countRemainingCodes(updatedCodes),
    };
  }

  return { success: false, error: "Invalid verification code" };
}

/**
 * Disable MFA for a user (requires admin or self with verification)
 */
export async function disableMFA(
  targetUserId: string,
  adminUserId: string,
  verificationCode?: string
): Promise<{ success: boolean; error?: string }> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      orgId: true,
      mfaEnabled: true,
      mfaSecret: true,
    },
  });

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  if (!targetUser.mfaEnabled) {
    return { success: false, error: "MFA is not enabled for this user" };
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      email: true,
      role: true,
      orgId: true,
    },
  });

  if (!adminUser) {
    return { success: false, error: "Admin user not found" };
  }

  // Check if same org
  if (targetUser.orgId !== adminUser.orgId) {
    return { success: false, error: "Unauthorized" };
  }

  const isSelf = targetUserId === adminUserId;
  const isAdmin =
    adminUser.role === UserRole.ADMIN || adminUser.role === UserRole.SUPER_ADMIN;

  if (isSelf) {
    // Self-disable requires verification code
    if (!verificationCode) {
      return { success: false, error: "Verification code required" };
    }

    const verifyResult = await verifyMFA(targetUserId, verificationCode);
    if (!verifyResult.success) {
      return { success: false, error: "Invalid verification code" };
    }
  } else if (!isAdmin) {
    return { success: false, error: "Only admins can disable MFA for other users" };
  }

  // Check if MFA is required for this user
  const { required, reason } = await isMFARequired(targetUserId);
  if (required && !isAdmin) {
    return { success: false, error: `Cannot disable MFA: ${reason}` };
  }

  // Disable MFA
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaEnabledAt: null,
      mfaLastUsed: null,
    },
  });

  // Audit log
  await createAuditLog({
    orgId: targetUser.orgId,
    userId: adminUserId,
    action: "UPDATE",
    resource: "USER",
    resourceId: targetUserId,
    resourceName: targetUser.email,
    details: {
      event: "MFA_DISABLED",
      disabledBy: adminUser.email,
      selfDisabled: isSelf,
    },
  });

  return { success: true };
}

/**
 * Regenerate backup codes for a user
 */
export async function regenerateBackupCodes(
  userId: string,
  verificationCode: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  // Verify current MFA first
  const verifyResult = await verifyMFA(userId, verificationCode);
  if (!verifyResult.success) {
    return { success: false, error: "Invalid verification code" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      orgId: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Generate new backup codes
  const backupCodesResult = await generateBackupCodes();

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaBackupCodes: backupCodesResult.hashedCodes,
    },
  });

  // Audit log
  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "UPDATE",
    resource: "USER",
    resourceId: user.id,
    resourceName: user.email,
    details: { event: "MFA_BACKUP_CODES_REGENERATED" },
  });

  return {
    success: true,
    backupCodes: formatCodesForDisplay(backupCodesResult.plainTextCodes),
  };
}

/**
 * Admin reset MFA for a user (when they're locked out)
 */
export async function adminResetMFA(
  targetUserId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      email: true,
      role: true,
      orgId: true,
    },
  });

  if (!adminUser) {
    return { success: false, error: "Admin user not found" };
  }

  const isAdmin =
    adminUser.role === UserRole.ADMIN || adminUser.role === UserRole.SUPER_ADMIN;

  if (!isAdmin) {
    return { success: false, error: "Only admins can reset MFA" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      orgId: true,
      mfaEnabled: true,
    },
  });

  if (!targetUser) {
    return { success: false, error: "User not found" };
  }

  // Check same org
  if (targetUser.orgId !== adminUser.orgId) {
    return { success: false, error: "Unauthorized" };
  }

  if (!targetUser.mfaEnabled) {
    return { success: false, error: "MFA is not enabled for this user" };
  }

  // Reset MFA
  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaEnabledAt: null,
      mfaLastUsed: null,
    },
  });

  // Audit log (important for compliance)
  await createAuditLog({
    orgId: targetUser.orgId,
    userId: adminUserId,
    action: "UPDATE",
    resource: "USER",
    resourceId: targetUserId,
    resourceName: targetUser.email,
    details: {
      event: "MFA_ADMIN_RESET",
      resetBy: adminUser.email,
    },
  });

  return { success: true };
}

/**
 * Set organization-wide MFA requirement
 */
export async function setOrganizationMFARequirement(
  orgId: string,
  adminUserId: string,
  requireMfa: boolean
): Promise<{ success: boolean; error?: string }> {
  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      email: true,
      role: true,
      orgId: true,
    },
  });

  if (!adminUser) {
    return { success: false, error: "Admin user not found" };
  }

  if (adminUser.orgId !== orgId) {
    return { success: false, error: "Unauthorized" };
  }

  const isAdmin =
    adminUser.role === UserRole.ADMIN || adminUser.role === UserRole.SUPER_ADMIN;

  if (!isAdmin) {
    return { success: false, error: "Only admins can change organization settings" };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { requireMfa },
  });

  // Audit log
  await createAuditLog({
    orgId,
    userId: adminUserId,
    action: "UPDATE",
    resource: "ORGANIZATION",
    resourceId: orgId,
    details: {
      event: "ORG_MFA_REQUIREMENT_CHANGED",
      requireMfa,
      changedBy: adminUser.email,
    },
  });

  return { success: true };
}
