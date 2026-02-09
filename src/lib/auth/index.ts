import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { SessionUser, UserPermissions } from "@/types";
import { UserRole } from "@/types";
import { checkMFARequired, getMFASetupRedirectUrl, isAdminRole } from "./mfa-enforcement";

/**
 * Get the current authenticated user with organization context
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Supabase auth error:", authError);
      return null;
    }

    if (!authUser) {
      return null;
    }

    // Fetch user from database with organization
    const user = await prisma.user.findUnique({
      where: { supabaseUserId: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        orgId: true,
        canCreateForms: true,
        canReadForms: true,
        canUpdateForms: true,
        canDeleteForms: true,
        canPublishForms: true,
        mfaEnabled: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      console.error("User not found in database for supabaseUserId:", authUser.id);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role as UserRole,
      orgId: user.orgId,
      orgName: user.organization.name,
      permissions: {
        canCreateForms: user.canCreateForms,
        canReadForms: user.canReadForms,
        canUpdateForms: user.canUpdateForms,
        canDeleteForms: user.canDeleteForms,
        canPublishForms: user.canPublishForms,
      },
      mfaEnabled: user.mfaEnabled,
    };
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    return null;
  }
}

/**
 * Require authentication - redirects to login if not authenticated.
 * For admin users (SUPER_ADMIN, ADMIN), enforces MFA setup if not enabled.
 *
 * @param options - Optional configuration
 * @param options.skipMFACheck - Skip MFA enforcement check (for MFA setup page)
 */
export async function requireAuth(options?: {
  skipMFACheck?: boolean;
}): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Check MFA requirement for admin users (unless explicitly skipped)
  if (!options?.skipMFACheck && isAdminRole(user.role)) {
    const mfaRequired = await checkMFARequired(user);
    if (mfaRequired) {
      redirect(getMFASetupRedirectUrl());
    }
  }

  return user;
}

/**
 * Require specific permission - redirects to dashboard with error if not permitted
 */
export async function requirePermission(
  permission: keyof UserPermissions
): Promise<SessionUser> {
  const user = await requireAuth();

  if (!user.permissions[permission]) {
    redirect("/dashboard?error=permission_denied");
  }

  return user;
}

/**
 * Require specific role - redirects to dashboard with error if not authorized
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard?error=unauthorized");
  }

  return user;
}

/**
 * Check if user has admin access (SUPER_ADMIN or ADMIN)
 */
export function isAdmin(user: SessionUser): boolean {
  return user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
}

/**
 * Check if user can manage forms (ADMIN, PROGRAM_MANAGER)
 */
export function canManageForms(user: SessionUser): boolean {
  return (
    user.role === UserRole.SUPER_ADMIN ||
    user.role === UserRole.ADMIN ||
    user.role === UserRole.PROGRAM_MANAGER
  );
}

/**
 * Get default permissions based on role
 */
export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.ADMIN:
      return {
        canCreateForms: true,
        canReadForms: true,
        canUpdateForms: true,
        canDeleteForms: true,
        canPublishForms: true,
      };
    case UserRole.PROGRAM_MANAGER:
      return {
        canCreateForms: true,
        canReadForms: true,
        canUpdateForms: true,
        canDeleteForms: false,
        canPublishForms: true,
      };
    case UserRole.CASE_MANAGER:
      return {
        canCreateForms: false,
        canReadForms: true,
        canUpdateForms: false,
        canDeleteForms: false,
        canPublishForms: false,
      };
    case UserRole.VIEWER:
      return {
        canCreateForms: false,
        canReadForms: true,
        canUpdateForms: false,
        canDeleteForms: false,
        canPublishForms: false,
      };
    default:
      return {
        canCreateForms: false,
        canReadForms: true,
        canUpdateForms: false,
        canDeleteForms: false,
        canPublishForms: false,
      };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
