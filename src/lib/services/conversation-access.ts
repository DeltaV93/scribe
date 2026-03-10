/**
 * Conversation Access Control Service (PX-865)
 * Manages access to conversations, especially for Tier 2 restricted content
 */

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import type {
  ConversationAccessType,
  SensitivityTier,
  UserRole,
} from "@prisma/client";

export interface AccessCheckResult {
  hasAccess: boolean;
  accessType?: ConversationAccessType;
  reason: string;
}

export interface ConversationAccessInfo {
  conversationId: string;
  userId: string;
  accessType: ConversationAccessType;
  grantedById?: string;
  grantedAt: Date;
}

/**
 * Check if a user can access a conversation
 * Considers: participation, explicit grants, role, and sensitivity tier
 */
export async function canAccessConversation(
  userId: string,
  conversationId: string
): Promise<AccessCheckResult> {
  // Fetch conversation with creator info
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      orgId: true,
      createdById: true,
      sensitivityTier: true,
    },
  });

  if (!conversation) {
    return {
      hasAccess: false,
      reason: "Conversation not found",
    };
  }

  // Fetch user with role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      orgId: true,
      role: true,
    },
  });

  if (!user) {
    return {
      hasAccess: false,
      reason: "User not found",
    };
  }

  // Verify user is in same org
  if (user.orgId !== conversation.orgId) {
    return {
      hasAccess: false,
      reason: "User not in same organization",
    };
  }

  // Standard tier - check basic org membership
  if (conversation.sensitivityTier === "STANDARD") {
    return {
      hasAccess: true,
      accessType: "INHERITED",
      reason: "Standard content, org member access",
    };
  }

  // Check if user is the creator
  if (conversation.createdById === userId) {
    return {
      hasAccess: true,
      accessType: "PARTICIPANT",
      reason: "User is conversation creator",
    };
  }

  // Check explicit access grant
  const accessGrant = await prisma.conversationAccess.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    select: {
      accessType: true,
      revokedAt: true,
    },
  });

  if (accessGrant && !accessGrant.revokedAt) {
    return {
      hasAccess: true,
      accessType: accessGrant.accessType,
      reason: `Access type: ${accessGrant.accessType}`,
    };
  }

  // Check admin access for restricted content
  if (isAdminRole(user.role)) {
    return {
      hasAccess: true,
      accessType: "INHERITED",
      reason: "Admin role access",
    };
  }

  // Redacted content is never accessible except to creator
  if (conversation.sensitivityTier === "REDACTED") {
    return {
      hasAccess: false,
      reason: "Redacted content only accessible by creator",
    };
  }

  // Default: no access to restricted content
  return {
    hasAccess: false,
    reason: "No access grant for restricted content",
  };
}

/**
 * Grant access to a conversation
 */
export async function grantAccess(
  conversationId: string,
  userId: string,
  grantedById: string,
  accessType: ConversationAccessType = "GRANTED"
): Promise<ConversationAccessInfo> {
  // Verify granter has access
  const granterAccess = await canAccessConversation(grantedById, conversationId);
  if (!granterAccess.hasAccess) {
    throw new Error("Granter does not have access to this conversation");
  }

  // Get conversation for audit
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { orgId: true, sensitivityTier: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Create or update access record
  const access = await prisma.conversationAccess.upsert({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    create: {
      conversationId,
      userId,
      grantedById,
      accessType,
    },
    update: {
      grantedById,
      accessType,
      grantedAt: new Date(),
      revokedAt: null, // Clear any revocation
    },
  });

  // Audit log for Tier 2 content
  if (conversation.sensitivityTier !== "STANDARD") {
    await createAuditLog({
      orgId: conversation.orgId,
      userId: grantedById,
      action: "CREATE",
      resource: "CONVERSATION_ACCESS",
      resourceId: conversationId,
      details: {
        grantedToUserId: userId,
        accessType,
        sensitivityTier: conversation.sensitivityTier,
      },
    });
  }

  return {
    conversationId: access.conversationId,
    userId: access.userId,
    accessType: access.accessType,
    grantedById: access.grantedById || undefined,
    grantedAt: access.grantedAt,
  };
}

/**
 * Revoke access to a conversation
 */
export async function revokeAccess(
  conversationId: string,
  userId: string,
  revokedById: string
): Promise<void> {
  // Get conversation for audit
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { orgId: true, sensitivityTier: true, createdById: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Cannot revoke creator's access
  if (conversation.createdById === userId) {
    throw new Error("Cannot revoke creator's access");
  }

  // Soft revoke the access
  await prisma.conversationAccess.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: {
      revokedAt: new Date(),
    },
  });

  // Audit log for Tier 2 content
  if (conversation.sensitivityTier !== "STANDARD") {
    await createAuditLog({
      orgId: conversation.orgId,
      userId: revokedById,
      action: "DELETE",
      resource: "CONVERSATION_ACCESS",
      resourceId: conversationId,
      details: {
        revokedUserId: userId,
        sensitivityTier: conversation.sensitivityTier,
      },
    });
  }
}

/**
 * Get all users with access to a conversation
 */
export async function getAccessList(
  conversationId: string
): Promise<ConversationAccessInfo[]> {
  const accessRecords = await prisma.conversationAccess.findMany({
    where: {
      conversationId,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      grantedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { grantedAt: "desc" },
  });

  return accessRecords.map((record) => ({
    conversationId: record.conversationId,
    userId: record.userId,
    accessType: record.accessType,
    grantedById: record.grantedById || undefined,
    grantedAt: record.grantedAt,
  }));
}

/**
 * Add participant access when someone joins a conversation
 */
export async function addParticipant(
  conversationId: string,
  userId: string
): Promise<void> {
  await prisma.conversationAccess.upsert({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    create: {
      conversationId,
      userId,
      accessType: "PARTICIPANT",
    },
    update: {
      // If already exists, don't change access type
    },
  });
}

/**
 * Bulk add participants
 */
export async function addParticipants(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => addParticipant(conversationId, userId))
  );
}

/**
 * Log access to restricted conversation (for audit trail)
 */
export async function logAccess(
  conversationId: string,
  userId: string,
  action: "VIEW" | "DOWNLOAD" | "EXPORT"
): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { orgId: true, sensitivityTier: true },
  });

  if (!conversation) return;

  // Only log for restricted content
  if (conversation.sensitivityTier !== "STANDARD") {
    await createAuditLog({
      orgId: conversation.orgId,
      userId,
      action,
      resource: "CONVERSATION",
      resourceId: conversationId,
      details: {
        sensitivityTier: conversation.sensitivityTier,
      },
    });
  }
}

/**
 * Check if a role has admin privileges
 */
function isAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Get users who can be granted access (same org, not already granted)
 */
export async function getGrantableUsers(
  conversationId: string,
  orgId: string
): Promise<Array<{ id: string; name: string | null; email: string }>> {
  // Get users already with access
  const existingAccess = await prisma.conversationAccess.findMany({
    where: {
      conversationId,
      revokedAt: null,
    },
    select: { userId: true },
  });

  const existingUserIds = existingAccess.map((a) => a.userId);

  // Get conversation creator
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { createdById: true },
  });

  if (conversation) {
    existingUserIds.push(conversation.createdById);
  }

  // Get org users who don't have access yet
  const users = await prisma.user.findMany({
    where: {
      orgId,
      isActive: true,
      id: { notIn: existingUserIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}
