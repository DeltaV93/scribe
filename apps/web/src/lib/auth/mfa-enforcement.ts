/**
 * MFA Enforcement Module
 *
 * Enforces MFA requirements for ALL users per security policy (PX-944).
 * Provides utilities to check MFA status and redirect users to MFA setup.
 */

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types";

/**
 * MFA status result
 */
export interface MFAStatusInfo {
  enabled: boolean;
  verifiedAt?: Date;
}

/**
 * Check if MFA is required for a user.
 * Per security policy (PX-944), MFA is required for ALL users.
 *
 * @param user - The session user to check
 * @returns Promise<boolean> - True if user needs to set up MFA
 */
export async function checkMFARequired(user: SessionUser): Promise<boolean> {
  // Check MFA status from database
  const mfaStatus = await getMFAStatus(user.id);

  // MFA is required for all users - return true if not enabled
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
 * Build the MFA setup redirect URL with required query parameter.
 *
 * @returns string - The MFA setup URL with required=true
 */
export function getMFASetupRedirectUrl(): string {
  return "/mfa-setup?required=true";
}
