import { prisma } from "@/lib/db";
import { MessageSenderType, MessageStatus, Prisma } from "@prisma/client";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

export interface CreateMessageInput {
  orgId: string;
  clientId: string;
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  attachments?: CreateAttachmentInput[];
}

export interface CreateAttachmentInput {
  filename: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
}

export interface MessageFilters {
  status?: MessageStatus;
  senderType?: MessageSenderType;
  since?: Date;
  before?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface MessageWithRelations {
  id: string;
  orgId: string;
  clientId: string;
  senderId: string | null;
  senderType: MessageSenderType;
  content: string;
  contentHash: string | null;
  status: MessageStatus;
  sentAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  sender?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  attachments?: {
    id: string;
    filename: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: Date;
  }[];
  smsNotification?: {
    id: string;
    deliveryStatus: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
  } | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate SHA-256 hash for message content integrity verification
 */
function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Calculate 7-year retention expiry date
 */
function calculateExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 7);
  return expiryDate;
}

// ============================================
// MESSAGE CRUD OPERATIONS
// ============================================

/**
 * Create a new message from case manager to client
 */
export async function createMessage(
  input: CreateMessageInput
): Promise<MessageWithRelations> {
  const { orgId, clientId, senderId, senderType, content, attachments } = input;

  // Verify client exists and belongs to org
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      orgId: orgId,
      deletedAt: null,
    },
  });

  if (!client) {
    throw new Error("Client not found or does not belong to organization");
  }

  // Generate content hash for integrity
  const contentHash = generateContentHash(content);

  // Create message with optional attachments
  const message = await prisma.message.create({
    data: {
      orgId,
      clientId,
      senderId: senderType === MessageSenderType.CASE_MANAGER ? senderId : null,
      senderType,
      content,
      contentHash,
      status: MessageStatus.SENT,
      sentAt: new Date(),
      expiresAt: calculateExpiryDate(),
      attachments: attachments
        ? {
            create: attachments.map((att) => ({
              filename: att.filename,
              fileUrl: att.fileUrl,
              mimeType: att.mimeType,
              fileSize: att.fileSize,
            })),
          }
        : undefined,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      attachments: true,
      smsNotification: true,
    },
  });

  return message as MessageWithRelations;
}

/**
 * Get messages for a specific client
 */
export async function getClientMessages(
  orgId: string,
  clientId: string,
  filters: MessageFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ messages: MessageWithRelations[]; total: number }> {
  const { status, senderType, since, before } = filters;
  const { page = 1, limit = 50 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.MessageWhereInput = {
    orgId,
    clientId,
    deletedAt: null,
    ...(status && { status }),
    ...(senderType && { senderType }),
    ...(since && { sentAt: { gte: since } }),
    ...(before && { sentAt: { lte: before } }),
  };

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        attachments: true,
        smsNotification: {
          select: {
            id: true,
            deliveryStatus: true,
            sentAt: true,
            deliveredAt: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({ where }),
  ]);

  return {
    messages: messages as MessageWithRelations[],
    total,
  };
}

/**
 * Get a single message by ID
 */
export async function getMessage(
  messageId: string,
  orgId: string
): Promise<MessageWithRelations | null> {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      orgId,
      deletedAt: null,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      attachments: true,
      smsNotification: {
        select: {
          id: true,
          deliveryStatus: true,
          sentAt: true,
          deliveredAt: true,
        },
      },
    },
  });

  return message as MessageWithRelations | null;
}

/**
 * Get a message by ID for portal access (no org restriction, uses client verification)
 */
export async function getMessageForPortal(
  messageId: string,
  clientId: string
): Promise<MessageWithRelations | null> {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      clientId,
      deletedAt: null,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      attachments: true,
    },
  });

  return message as MessageWithRelations | null;
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(
  messageId: string,
  clientId: string
): Promise<MessageWithRelations> {
  const message = await prisma.message.update({
    where: {
      id: messageId,
      clientId, // Ensure client owns this message
    },
    data: {
      status: MessageStatus.READ,
      readAt: new Date(),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      attachments: true,
    },
  });

  return message as MessageWithRelations;
}

/**
 * Update message delivery status (called when SMS is delivered)
 */
export async function updateMessageDeliveryStatus(
  messageId: string,
  status: MessageStatus
): Promise<void> {
  await prisma.message.update({
    where: { id: messageId },
    data: {
      status,
      deliveredAt: status === MessageStatus.DELIVERED ? new Date() : undefined,
    },
  });
}

/**
 * Soft delete a message
 */
export async function deleteMessage(
  messageId: string,
  orgId: string
): Promise<void> {
  await prisma.message.update({
    where: {
      id: messageId,
      orgId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

/**
 * Get unread message count for a client
 */
export async function getUnreadCount(clientId: string): Promise<number> {
  return prisma.message.count({
    where: {
      clientId,
      senderType: MessageSenderType.CASE_MANAGER, // Only count incoming messages
      status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
      deletedAt: null,
    },
  });
}

/**
 * Get unread message count for case manager (messages from clients)
 */
export async function getUnreadCountForCaseManager(
  orgId: string,
  assignedClientIds?: string[]
): Promise<number> {
  return prisma.message.count({
    where: {
      orgId,
      senderType: MessageSenderType.CLIENT,
      status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
      deletedAt: null,
      ...(assignedClientIds && { clientId: { in: assignedClientIds } }),
    },
  });
}

// ============================================
// CLIENT REPLY OPERATIONS
// ============================================

/**
 * Create a reply from client (through portal)
 */
export async function createClientReply(
  clientId: string,
  content: string
): Promise<MessageWithRelations> {
  // Get the client with assigned case manager
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      orgId: true,
      firstName: true,
      lastName: true,
      assignedUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const contentHash = generateContentHash(content);

  const message = await prisma.message.create({
    data: {
      orgId: client.orgId,
      clientId,
      senderId: null, // Client replies have no sender user
      senderType: MessageSenderType.CLIENT,
      content,
      contentHash,
      status: MessageStatus.SENT,
      sentAt: new Date(),
      expiresAt: calculateExpiryDate(),
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      attachments: true,
    },
  });

  // Send email notification to assigned case manager (async, don't block response)
  if (client.assignedUser) {
    import("./email-notifications").then(({ notifyCaseManagerOfReply }) => {
      notifyCaseManagerOfReply(client.assignedUser!.email, {
        caseManagerName: client.assignedUser!.name || "Case Manager",
        clientFirstName: client.firstName,
        clientLastName: client.lastName,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/clients/${clientId}/messages`,
      }).catch((err) => {
        console.error("Failed to send case manager notification:", err);
      });
    });
  }

  return message as MessageWithRelations;
}

// ============================================
// ATTACHMENT OPERATIONS
// ============================================

/**
 * Add attachment to existing message
 */
export async function addAttachment(
  messageId: string,
  attachment: CreateAttachmentInput
): Promise<void> {
  await prisma.messageAttachment.create({
    data: {
      messageId,
      filename: attachment.filename,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    },
  });
}

/**
 * Get attachment by ID with message verification
 */
export async function getAttachment(
  attachmentId: string,
  messageId: string
): Promise<{
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
} | null> {
  return prisma.messageAttachment.findFirst({
    where: {
      id: attachmentId,
      messageId,
    },
    select: {
      id: true,
      filename: true,
      fileUrl: true,
      mimeType: true,
      fileSize: true,
    },
  });
}

// ============================================
// VALIDATION HELPERS
// ============================================

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate attachment file type
 */
export function validateAttachmentType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Validate attachment file size
 */
export function validateAttachmentSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Get allowed MIME types for client display
 */
export function getAllowedMimeTypes(): string[] {
  return [...ALLOWED_MIME_TYPES];
}

/**
 * Get max file size for client display
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}
