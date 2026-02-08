import { prisma } from "@/lib/db";
import { ClientSharePermission, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/service";

// ============================================
// TYPES
// ============================================

export interface ShareClientInput {
  clientId: string;
  sharedWithUserId: string;
  permission: ClientSharePermission;
  expiresAt?: Date | null;
  notes?: string | null;
}

export interface ShareClientOptions {
  expiresAt?: Date | null;
  notes?: string | null;
}

export interface ClientShareWithDetails {
  id: string;
  clientId: string;
  permission: ClientSharePermission;
  expiresAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  sharedWithUser: {
    id: string;
    name: string | null;
    email: string;
  };
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface SharedClientWithDetails {
  id: string;
  clientId: string;
  permission: ClientSharePermission;
  expiresAt: Date | null;
  notes: string | null;
  createdAt: Date;
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    status: string;
    assignedUser: {
      id: string;
      name: string | null;
      email: string;
    };
  };
}

export type AccessCheckResult = {
  hasAccess: boolean;
  permission: ClientSharePermission | null;
  isOwner: boolean;
  shareId?: string;
  expiresAt?: Date | null;
};

// ============================================
// CLIENT SHARING SERVICE
// ============================================

/**
 * Share a client with another user
 * HIPAA: Creates audit log for client share event
 */
export async function shareClient(
  clientId: string,
  sharedWithUserId: string,
  permission: ClientSharePermission,
  sharedByUserId: string,
  orgId: string,
  options: ShareClientOptions = {}
): Promise<ClientShareWithDetails> {
  // Verify client exists and belongs to the org
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Verify the target user exists and belongs to the same org
  const targetUser = await prisma.user.findFirst({
    where: { id: sharedWithUserId, orgId, isActive: true },
  });

  if (!targetUser) {
    throw new Error("Target user not found or is inactive");
  }

  // Prevent sharing with self
  if (sharedWithUserId === sharedByUserId) {
    throw new Error("Cannot share a client with yourself");
  }

  // Prevent sharing with the client's assigned case manager (they already have full access)
  if (sharedWithUserId === client.assignedTo) {
    throw new Error("This user is already assigned to this client");
  }

  // Check if share already exists (upsert logic)
  const existingShare = await prisma.clientShare.findUnique({
    where: {
      clientId_sharedWithUserId: {
        clientId,
        sharedWithUserId,
      },
    },
  });

  let share;

  if (existingShare) {
    // Update existing share (reactivate if revoked, update permission)
    share = await prisma.clientShare.update({
      where: { id: existingShare.id },
      data: {
        permission,
        expiresAt: options.expiresAt ?? null,
        notes: options.notes ?? null,
        revokedAt: null, // Reactivate if was revoked
        updatedAt: new Date(),
      },
      include: {
        sharedWithUser: {
          select: { id: true, name: true, email: true },
        },
        sharedByUser: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  } else {
    // Create new share
    share = await prisma.clientShare.create({
      data: {
        clientId,
        sharedWithUserId,
        sharedByUserId,
        orgId,
        permission,
        expiresAt: options.expiresAt ?? null,
        notes: options.notes ?? null,
      },
      include: {
        sharedWithUser: {
          select: { id: true, name: true, email: true },
        },
        sharedByUser: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // HIPAA Audit Log: Client shared
  await createAuditLog({
    orgId,
    userId: sharedByUserId,
    action: "SHARE",
    resource: "CLIENT_SHARE",
    resourceId: share.id,
    resourceName: `${client.firstName} ${client.lastName}`,
    details: {
      clientId,
      sharedWithUserId,
      sharedWithEmail: targetUser.email,
      permission,
      expiresAt: options.expiresAt?.toISOString() ?? null,
      isUpdate: !!existingShare,
    },
  });

  return share;
}

/**
 * Revoke a client share
 * HIPAA: Creates audit log for share revocation
 */
export async function revokeShare(
  shareId: string,
  revokedByUserId: string,
  orgId: string
): Promise<void> {
  // Find the share
  const share = await prisma.clientShare.findFirst({
    where: { id: shareId, orgId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      sharedWithUser: { select: { id: true, email: true } },
    },
  });

  if (!share) {
    throw new Error("Share not found");
  }

  if (share.revokedAt) {
    throw new Error("Share is already revoked");
  }

  // Soft revoke the share
  await prisma.clientShare.update({
    where: { id: shareId },
    data: { revokedAt: new Date() },
  });

  // HIPAA Audit Log: Share revoked
  await createAuditLog({
    orgId,
    userId: revokedByUserId,
    action: "REVOKE",
    resource: "CLIENT_SHARE",
    resourceId: shareId,
    resourceName: `${share.client.firstName} ${share.client.lastName}`,
    details: {
      clientId: share.clientId,
      sharedWithUserId: share.sharedWithUserId,
      sharedWithEmail: share.sharedWithUser.email,
      originalPermission: share.permission,
    },
  });
}

/**
 * Get all shares for a specific client
 */
export async function getClientShares(
  clientId: string,
  orgId: string,
  includeRevoked = false
): Promise<ClientShareWithDetails[]> {
  const where: Prisma.ClientShareWhereInput = {
    clientId,
    orgId,
  };

  if (!includeRevoked) {
    where.revokedAt = null;
    // Exclude expired shares
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  return prisma.clientShare.findMany({
    where,
    include: {
      sharedWithUser: {
        select: { id: true, name: true, email: true },
      },
      sharedByUser: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all clients shared with a specific user
 */
export async function getSharedWithMe(
  userId: string,
  orgId: string
): Promise<SharedClientWithDetails[]> {
  const now = new Date();

  const shares = await prisma.clientShare.findMany({
    where: {
      sharedWithUserId: userId,
      orgId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      // Only include clients that haven't been deleted
      client: { deletedAt: null },
    },
    include: {
      sharedByUser: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return shares;
}

/**
 * Check if a user has access to a client (either as owner or through sharing)
 * HIPAA: This is the central access control check
 */
export async function checkAccess(
  clientId: string,
  userId: string,
  orgId: string
): Promise<AccessCheckResult> {
  // First check if user is the assigned case manager (owner)
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId, deletedAt: null },
    select: { assignedTo: true },
  });

  if (!client) {
    return { hasAccess: false, permission: null, isOwner: false };
  }

  if (client.assignedTo === userId) {
    return {
      hasAccess: true,
      permission: "FULL" as ClientSharePermission,
      isOwner: true,
    };
  }

  // Check for active share
  const now = new Date();
  const share = await prisma.clientShare.findFirst({
    where: {
      clientId,
      sharedWithUserId: userId,
      orgId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      permission: true,
      expiresAt: true,
    },
  });

  if (share) {
    return {
      hasAccess: true,
      permission: share.permission,
      isOwner: false,
      shareId: share.id,
      expiresAt: share.expiresAt,
    };
  }

  return { hasAccess: false, permission: null, isOwner: false };
}

/**
 * Check if user can edit a client based on their access
 */
export async function canEditClient(
  clientId: string,
  userId: string,
  orgId: string
): Promise<boolean> {
  const access = await checkAccess(clientId, userId, orgId);

  if (!access.hasAccess) {
    return false;
  }

  // Owner and users with EDIT or FULL permission can edit
  return (
    access.isOwner ||
    access.permission === "EDIT" ||
    access.permission === "FULL"
  );
}

/**
 * Update an existing share's permission or expiration
 */
export async function updateShare(
  shareId: string,
  orgId: string,
  updatedByUserId: string,
  updates: {
    permission?: ClientSharePermission;
    expiresAt?: Date | null;
    notes?: string | null;
  }
): Promise<ClientShareWithDetails> {
  const share = await prisma.clientShare.findFirst({
    where: { id: shareId, orgId, revokedAt: null },
    include: {
      client: { select: { firstName: true, lastName: true } },
      sharedWithUser: { select: { email: true } },
    },
  });

  if (!share) {
    throw new Error("Share not found or already revoked");
  }

  const updateData: Prisma.ClientShareUpdateInput = {};
  if (updates.permission !== undefined) {
    updateData.permission = updates.permission;
  }
  if (updates.expiresAt !== undefined) {
    updateData.expiresAt = updates.expiresAt;
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  const updatedShare = await prisma.clientShare.update({
    where: { id: shareId },
    data: updateData,
    include: {
      sharedWithUser: {
        select: { id: true, name: true, email: true },
      },
      sharedByUser: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  // HIPAA Audit Log: Share updated
  await createAuditLog({
    orgId,
    userId: updatedByUserId,
    action: "UPDATE",
    resource: "CLIENT_SHARE",
    resourceId: shareId,
    resourceName: `${share.client.firstName} ${share.client.lastName}`,
    details: {
      clientId: share.clientId,
      sharedWithEmail: share.sharedWithUser.email,
      changes: updates,
    },
  });

  return updatedShare;
}

/**
 * Get a specific share by ID
 */
export async function getShareById(
  shareId: string,
  orgId: string
): Promise<ClientShareWithDetails | null> {
  return prisma.clientShare.findFirst({
    where: { id: shareId, orgId },
    include: {
      sharedWithUser: {
        select: { id: true, name: true, email: true },
      },
      sharedByUser: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
}
