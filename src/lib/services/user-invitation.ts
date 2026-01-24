import { prisma } from "@/lib/db";
import { getDefaultPermissions } from "@/lib/auth";
import { InvitationStatus, UserRole as PrismaUserRole } from "@prisma/client";
import { UserRole } from "@/types";
import crypto from "crypto";

// ============================================
// Types
// ============================================

export interface CreateInvitationInput {
  email: string;
  name: string;
  role: PrismaUserRole;
  teamId?: string;
  maxCaseload?: number;
  invitedById: string;
  orgId: string;
}

export interface BulkInviteResult {
  successful: { email: string; name: string }[];
  failed: { email: string; name: string; reason: string }[];
}

export interface InvitationWithOrg {
  id: string;
  email: string;
  name: string;
  role: PrismaUserRole;
  teamId: string | null;
  maxCaseload: number | null;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  reminderSentAt: Date | null;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

// ============================================
// Constants
// ============================================

const INVITATION_EXPIRY_DAYS = 7;
const REMINDER_AFTER_DAYS = 3;

// User limits by tier
export const USER_LIMITS_BY_TIER = {
  FREE: 3,
  STARTER: 10,
  PROFESSIONAL: 50,
  ENTERPRISE: 999999, // Effectively unlimited
};

// ============================================
// Invitation Service
// ============================================

/**
 * Generate a secure random token for invitation links
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Calculate expiration date (7 days from now)
 */
function getExpirationDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + INVITATION_EXPIRY_DAYS);
  return date;
}

/**
 * Check if organization has reached user limit
 */
export async function checkUserLimit(orgId: string): Promise<{
  canInvite: boolean;
  currentCount: number;
  limit: number;
  tier: string;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { tier: true, userLimit: true },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const activeUserCount = await prisma.user.count({
    where: {
      orgId,
      isActive: true,
    },
  });

  const pendingInvites = await prisma.userInvitation.count({
    where: {
      orgId,
      status: InvitationStatus.PENDING,
    },
  });

  const totalCount = activeUserCount + pendingInvites;
  const limit = org.userLimit || USER_LIMITS_BY_TIER[org.tier];

  return {
    canInvite: totalCount < limit,
    currentCount: totalCount,
    limit,
    tier: org.tier,
  };
}

/**
 * Create a new user invitation
 */
export async function createInvitation(
  input: CreateInvitationInput
): Promise<InvitationWithOrg> {
  const { email, name, role, teamId, maxCaseload, invitedById, orgId } = input;

  // Check if email already exists as active user in this org
  const existingUser = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      orgId,
      isActive: true,
    },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists in your organization");
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.userInvitation.findFirst({
    where: {
      email: email.toLowerCase(),
      orgId,
      status: InvitationStatus.PENDING,
    },
  });

  if (existingInvitation) {
    throw new Error("An invitation has already been sent to this email address");
  }

  // Check user limit
  const limitCheck = await checkUserLimit(orgId);
  if (!limitCheck.canInvite) {
    throw new Error(
      `Your organization has reached its user limit (${limitCheck.limit}). Please upgrade your plan to invite more users.`
    );
  }

  // Create the invitation
  const invitation = await prisma.userInvitation.create({
    data: {
      email: email.toLowerCase(),
      name,
      role,
      teamId,
      maxCaseload,
      token: generateToken(),
      expiresAt: getExpirationDate(),
      invitedById,
      orgId,
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  return invitation;
}

/**
 * Create multiple invitations from CSV data
 */
export async function createBulkInvitations(
  invitations: Omit<CreateInvitationInput, "invitedById" | "orgId">[],
  invitedById: string,
  orgId: string
): Promise<BulkInviteResult> {
  const result: BulkInviteResult = {
    successful: [],
    failed: [],
  };

  // Check user limit for bulk
  const limitCheck = await checkUserLimit(orgId);
  const remainingSlots = limitCheck.limit - limitCheck.currentCount;

  if (invitations.length > remainingSlots) {
    throw new Error(
      `Cannot invite ${invitations.length} users. You have ${remainingSlots} slot(s) remaining on your plan.`
    );
  }

  for (const invite of invitations) {
    try {
      await createInvitation({
        ...invite,
        invitedById,
        orgId,
      });
      result.successful.push({ email: invite.email, name: invite.name });
    } catch (error) {
      result.failed.push({
        email: invite.email,
        name: invite.name,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

/**
 * Get pending invitations for an organization
 */
export async function getPendingInvitations(
  orgId: string
): Promise<InvitationWithOrg[]> {
  return prisma.userInvitation.findMany({
    where: {
      orgId,
      status: InvitationStatus.PENDING,
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all invitations for an organization (including expired/accepted)
 */
export async function getAllInvitations(
  orgId: string,
  status?: InvitationStatus
): Promise<InvitationWithOrg[]> {
  return prisma.userInvitation.findMany({
    where: {
      orgId,
      ...(status && { status }),
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get invitation by token (for accepting invitation)
 */
export async function getInvitationByToken(
  token: string
): Promise<InvitationWithOrg | null> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { token },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  return invitation;
}

/**
 * Validate invitation token - checks if valid and not expired
 */
export async function validateInvitationToken(token: string): Promise<{
  valid: boolean;
  invitation?: InvitationWithOrg;
  error?: string;
}> {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return { valid: false, error: "Invitation not found" };
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    return { valid: false, error: "This invitation has already been used" };
  }

  if (invitation.status === InvitationStatus.REVOKED) {
    return { valid: false, error: "This invitation has been revoked" };
  }

  if (invitation.status === InvitationStatus.EXPIRED || new Date() > invitation.expiresAt) {
    // Mark as expired if not already
    if (invitation.status !== InvitationStatus.EXPIRED) {
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    }
    return { valid: false, error: "This invitation has expired. Please request a new one." };
  }

  return { valid: true, invitation };
}

/**
 * Accept invitation and create user account
 */
export async function acceptInvitation(
  token: string,
  supabaseUserId: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  const validation = await validateInvitationToken(token);

  if (!validation.valid || !validation.invitation) {
    return { success: false, error: validation.error };
  }

  const invitation = validation.invitation;
  const permissions = getDefaultPermissions(invitation.role as UserRole);

  try {
    // Create user and update invitation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          supabaseUserId,
          orgId: invitation.organization.id,
          maxCaseload: invitation.maxCaseload,
          canCreateForms: permissions.canCreateForms,
          canReadForms: permissions.canReadForms,
          canUpdateForms: permissions.canUpdateForms,
          canDeleteForms: permissions.canDeleteForms,
          canPublishForms: permissions.canPublishForms,
        },
      });

      // If team was specified, add user to team
      if (invitation.teamId) {
        await tx.teamMember.create({
          data: {
            teamId: invitation.teamId,
            userId: user.id,
          },
        });
      }

      // Mark invitation as accepted
      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    return { success: true, userId: result.id };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create account",
    };
  }
}

/**
 * Resend invitation email (regenerates token and expiry)
 */
export async function resendInvitation(invitationId: string): Promise<InvitationWithOrg> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    throw new Error("Cannot resend an invitation that has already been accepted");
  }

  // Generate new token and expiry
  const updated = await prisma.userInvitation.update({
    where: { id: invitationId },
    data: {
      token: generateToken(),
      expiresAt: getExpirationDate(),
      status: InvitationStatus.PENDING,
      revokedAt: null,
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });

  return updated;
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitation = await prisma.userInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status === InvitationStatus.ACCEPTED) {
    throw new Error("Cannot revoke an invitation that has already been accepted");
  }

  await prisma.userInvitation.update({
    where: { id: invitationId },
    data: {
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(),
    },
  });
}

/**
 * Mark reminder as sent for an invitation
 */
export async function markReminderSent(invitationId: string): Promise<void> {
  await prisma.userInvitation.update({
    where: { id: invitationId },
    data: { reminderSentAt: new Date() },
  });
}

/**
 * Get invitations that need reminder emails (3+ days old, no reminder sent)
 */
export async function getInvitationsNeedingReminder(
  orgId?: string
): Promise<InvitationWithOrg[]> {
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() - REMINDER_AFTER_DAYS);

  return prisma.userInvitation.findMany({
    where: {
      status: InvitationStatus.PENDING,
      createdAt: { lte: reminderThreshold },
      reminderSentAt: null,
      ...(orgId && { orgId }),
    },
    include: {
      invitedBy: {
        select: { id: true, name: true, email: true },
      },
      organization: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Expire old invitations (run as scheduled job)
 */
export async function expireOldInvitations(): Promise<number> {
  const result = await prisma.userInvitation.updateMany({
    where: {
      status: InvitationStatus.PENDING,
      expiresAt: { lte: new Date() },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });

  return result.count;
}

/**
 * Get invitation URL
 */
export function getInvitationUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/accept-invite/${token}`;
}
