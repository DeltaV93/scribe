/**
 * MFA Enforcement Module
 *
 * Enforces MFA requirements for admin users (SUPER_ADMIN, ADMIN).
 * Provides utilities to check MFA status and redirect users to MFA setup.
 */

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types";
import { UserRole } from "@/types";

// Roles that require MFA enforcement
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

/**
 * MFA status result
 */
export interface MFAStatusInfo {
  enabled: boolean;
  verifiedAt?: Date;
}

/**
 * Check if MFA is required for a user based on their role.
 * Returns true if the user is an admin (SUPER_ADMIN or ADMIN) without MFA enabled.
 *
 * @param user - The session user to check
 * @returns Promise<boolean> - True if user needs to set up MFA
 */
export async function checkMFARequired(user: SessionUser): Promise<boolean> {
  // Only enforce MFA for admin roles
  if (!ADMIN_ROLES.includes(user.role)) {
    return false;
  }

  // Check MFA status from database
  const mfaStatus = await getMFAStatus(user.id);

  // If MFA is not enabled, it's required
  return !mfaStatus.enabled;
}

/**
 * Get MFA status for a user.
 * Returns whether MFA is enabled and the date it was verified.
 *
 * @param userId - The user ID to check
 * @returns Promise<MFAStatusInfo> - MFA status information
 */
export async function getMFAStatus(userId: string): Promise<MFAStatusInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaEnabled: true,
      mfaEnabledAt: true,
    },
  });

  if (!user) {
    // User not found - return disabled status
    return { enabled: false };
  }

  return {
    enabled: user.mfaEnabled,
    verifiedAt: user.mfaEnabledAt ?? undefined,
  };
}

/**
 * Check if a user role requires MFA enforcement.
 *
 * @param role - The user role to check
 * @returns boolean - True if the role requires MFA
 */
export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * Build the MFA setup redirect URL with required query parameter.
 *
 * @returns string - The MFA setup URL with required=true
 */
export function getMFASetupRedirectUrl(): string {
  return "/mfa-setup?required=true";
}
