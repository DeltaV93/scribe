import { prisma } from "@/lib/db";
import { getDefaultPermissions } from "@/lib/auth";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { UserRole } from "@/types";

// ============================================
// Types
// ============================================

export interface UserWithDetails {
  id: string;
  email: string;
  name: string | null;
  role: PrismaUserRole;
  isActive: boolean;
  maxCaseload: number | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  teamMemberships: {
    team: {
      id: string;
      name: string;
    };
  }[];
  _count: {
    assignedClients: number;
    calls: number;
    formSubmissions: number;
  };
}

export interface UpdateUserInput {
  name?: string;
  role?: PrismaUserRole;
  teamId?: string | null; // null to remove from team
  maxCaseload?: number | null;
}

export interface TransferDataInput {
  fromUserId: string;
  toUserId: string;
  transferClients: boolean;
  transferSubmissions: boolean;
}

// ============================================
// User Management Service
// ============================================

/**
 * Get all users in an organization with their details
 */
export async function getOrganizationUsers(
  orgId: string,
  includeInactive = false
): Promise<UserWithDetails[]> {
  return prisma.user.findMany({
    where: {
      orgId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      maxCaseload: true,
      lastLoginAt: true,
      createdAt: true,
      deactivatedAt: true,
      teamMemberships: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          assignedClients: true,
          calls: true,
          formSubmissions: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/**
 * Get a single user by ID with full details
 */
export async function getUserById(
  userId: string,
  orgId: string
): Promise<UserWithDetails | null> {
  return prisma.user.findFirst({
    where: {
      id: userId,
      orgId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      maxCaseload: true,
      lastLoginAt: true,
      createdAt: true,
      deactivatedAt: true,
      teamMemberships: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          assignedClients: true,
          calls: true,
          formSubmissions: true,
        },
      },
    },
  });
}

/**
 * Update user details
 */
export async function updateUser(
  userId: string,
  orgId: string,
  input: UpdateUserInput
): Promise<UserWithDetails> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.maxCaseload !== undefined) {
    updateData.maxCaseload = input.maxCaseload;
  }

  if (input.role !== undefined && input.role !== user.role) {
    // Update role and associated permissions
    const permissions = getDefaultPermissions(input.role as UserRole);
    updateData.role = input.role;
    updateData.canCreateForms = permissions.canCreateForms;
    updateData.canReadForms = permissions.canReadForms;
    updateData.canUpdateForms = permissions.canUpdateForms;
    updateData.canDeleteForms = permissions.canDeleteForms;
    updateData.canPublishForms = permissions.canPublishForms;
  }

  // Handle team membership
  if (input.teamId !== undefined) {
    await prisma.$transaction(async (tx) => {
      // Remove from current teams
      await tx.teamMember.deleteMany({
        where: { userId },
      });

      // Add to new team if specified
      if (input.teamId) {
        // Verify team belongs to same org
        const team = await tx.team.findFirst({
          where: { id: input.teamId, orgId },
        });

        if (!team) {
          throw new Error("Team not found in your organization");
        }

        await tx.teamMember.create({
          data: {
            userId,
            teamId: input.teamId,
          },
        });
      }
    });
  }

  // Update user if there are changes
  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  // Return updated user
  const updatedUser = await getUserById(userId, orgId);
  if (!updatedUser) {
    throw new Error("Failed to fetch updated user");
  }

  return updatedUser;
}

/**
 * Deactivate a user (soft delete - preserves data)
 */
export async function deactivateUser(
  userId: string,
  orgId: string,
  deactivatedById: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("User is already deactivated");
  }

  // Prevent deactivating yourself
  if (userId === deactivatedById) {
    throw new Error("You cannot deactivate your own account");
  }

  // Check if user has active work that needs reassignment
  const activeClients = await prisma.client.count({
    where: {
      assignedTo: userId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
  });

  if (activeClients > 0) {
    throw new Error(
      `This user has ${activeClients} active client(s). Please reassign them before deactivating.`
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedById,
    },
  });
}

/**
 * Reactivate a user
 */
export async function reactivateUser(userId: string, orgId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.isActive) {
    throw new Error("User is already active");
  }

  // Check user limit before reactivating
  const { checkUserLimit } = await import("./user-invitation");
  const limitCheck = await checkUserLimit(orgId);

  if (!limitCheck.canInvite) {
    throw new Error(
      `Your organization has reached its user limit (${limitCheck.limit}). Please upgrade your plan to reactivate this user.`
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null,
    },
  });
}

/**
 * Transfer user data to another user
 */
export async function transferUserData(
  input: TransferDataInput,
  orgId: string
): Promise<{ clientsTransferred: number; submissionsTransferred: number }> {
  const { fromUserId, toUserId, transferClients, transferSubmissions } = input;

  // Verify both users exist in the same org
  const [fromUser, toUser] = await Promise.all([
    prisma.user.findFirst({ where: { id: fromUserId, orgId } }),
    prisma.user.findFirst({ where: { id: toUserId, orgId, isActive: true } }),
  ]);

  if (!fromUser) {
    throw new Error("Source user not found");
  }

  if (!toUser) {
    throw new Error("Target user not found or is inactive");
  }

  let clientsTransferred = 0;
  let submissionsTransferred = 0;

  await prisma.$transaction(async (tx) => {
    if (transferClients) {
      const result = await tx.client.updateMany({
        where: { assignedTo: fromUserId },
        data: { assignedTo: toUserId },
      });
      clientsTransferred = result.count;
    }

    if (transferSubmissions) {
      const result = await tx.formSubmission.updateMany({
        where: { submittedById: fromUserId },
        data: { submittedById: toUserId },
      });
      submissionsTransferred = result.count;
    }
  });

  return { clientsTransferred, submissionsTransferred };
}

/**
 * Delete a user permanently (requires data transfer first)
 */
export async function deleteUser(
  userId: string,
  orgId: string,
  deletedById: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
    include: {
      _count: {
        select: {
          assignedClients: true,
          calls: true,
          formSubmissions: true,
          notes: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Prevent deleting yourself
  if (userId === deletedById) {
    throw new Error("You cannot delete your own account");
  }

  // Check for any remaining data
  const totalItems =
    user._count.assignedClients +
    user._count.calls +
    user._count.formSubmissions +
    user._count.notes;

  if (totalItems > 0) {
    throw new Error(
      `This user still has associated data (${user._count.assignedClients} clients, ${user._count.calls} calls, ${user._count.formSubmissions} submissions, ${user._count.notes} notes). Please transfer or remove this data before deleting.`
    );
  }

  // Delete in transaction
  await prisma.$transaction(async (tx) => {
    // Remove team memberships
    await tx.teamMember.deleteMany({ where: { userId } });

    // Remove form access grants
    await tx.formAccess.deleteMany({ where: { grantedById: userId } });

    // Delete the user
    await tx.user.delete({ where: { id: userId } });
  });
}

/**
 * Get users available for data transfer (active users excluding source)
 */
export async function getTransferCandidates(
  orgId: string,
  excludeUserId: string
): Promise<{ id: string; name: string | null; email: string; role: PrismaUserRole }[]> {
  return prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      id: { not: excludeUserId },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Get teams in an organization
 */
export async function getOrganizationTeams(
  orgId: string
): Promise<{ id: string; name: string; memberCount: number }[]> {
  const teams = await prisma.team.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      _count: {
        select: { members: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    memberCount: team._count.members,
  }));
}
