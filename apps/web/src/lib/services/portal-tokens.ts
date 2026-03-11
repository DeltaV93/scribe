import { prisma } from "@/lib/db";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

export interface PortalTokenResult {
  token: string;
  expiresAt: Date;
  portalUrl: string;
}

export interface ValidatedToken {
  isValid: boolean;
  clientId?: string;
  messageId?: string | null;
  expiresAt?: Date;
  error?: string;
}

// ============================================
// CONFIGURATION
// ============================================

// Token expiry time: 24 hours
const TOKEN_EXPIRY_HOURS = 24;

// Token length in bytes (will be hex encoded, so 32 bytes = 64 chars)
const TOKEN_BYTES = 32;

/**
 * Get the portal base URL from environment
 */
function getPortalBaseUrl(): string {
  return process.env.PORTAL_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Calculate token expiry date (24 hours from now)
 */
function calculateExpiryDate(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + TOKEN_EXPIRY_HOURS);
  return expiryDate;
}

/**
 * Generate a portal access token for a client
 *
 * @param clientId - The client's ID
 * @param messageId - Optional specific message to link to
 * @returns Token details including the full portal URL
 */
export async function generatePortalToken(
  clientId: string,
  messageId?: string
): Promise<PortalTokenResult> {
  // Verify client exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Generate secure token
  const token = generateSecureToken();
  const expiresAt = calculateExpiryDate();

  // Store token in database
  await prisma.portalToken.create({
    data: {
      clientId,
      token,
      messageId: messageId || null,
      expiresAt,
    },
  });

  // Build portal URL
  const portalUrl = `${getPortalBaseUrl()}/portal/m/${token}`;

  return {
    token,
    expiresAt,
    portalUrl,
  };
}

// ============================================
// TOKEN VALIDATION
// ============================================

/**
 * Validate a portal token and return client info if valid
 *
 * @param token - The token to validate
 * @returns Validation result with client ID if valid
 */
export async function validatePortalToken(token: string): Promise<ValidatedToken> {
  // Find the token
  const portalToken = await prisma.portalToken.findUnique({
    where: { token },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          deletedAt: true,
        },
      },
    },
  });

  // Token not found
  if (!portalToken) {
    return {
      isValid: false,
      error: "Invalid or expired token",
    };
  }

  // Check if expired
  if (portalToken.expiresAt < new Date()) {
    return {
      isValid: false,
      error: "Token has expired",
    };
  }

  // Check if client is deleted
  if (portalToken.client.deletedAt) {
    return {
      isValid: false,
      error: "Client account no longer exists",
    };
  }

  // Mark token as used (first use timestamp)
  if (!portalToken.usedAt) {
    await prisma.portalToken.update({
      where: { id: portalToken.id },
      data: { usedAt: new Date() },
    });
  }

  return {
    isValid: true,
    clientId: portalToken.clientId,
    messageId: portalToken.messageId,
    expiresAt: portalToken.expiresAt,
  };
}

/**
 * Validate token and get full client details for portal session
 */
export async function getPortalSession(token: string): Promise<{
  isValid: boolean;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    orgId: string;
    organization: {
      name: string;
    };
  };
  messageId?: string | null;
  expiresAt?: Date;
  error?: string;
}> {
  const portalToken = await prisma.portalToken.findUnique({
    where: { token },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          orgId: true,
          deletedAt: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!portalToken) {
    return {
      isValid: false,
      error: "Invalid or expired token",
    };
  }

  if (portalToken.expiresAt < new Date()) {
    return {
      isValid: false,
      error: "Token has expired",
    };
  }

  if (portalToken.client.deletedAt) {
    return {
      isValid: false,
      error: "Client account no longer exists",
    };
  }

  // Mark as used
  if (!portalToken.usedAt) {
    await prisma.portalToken.update({
      where: { id: portalToken.id },
      data: { usedAt: new Date() },
    });
  }

  return {
    isValid: true,
    client: {
      id: portalToken.client.id,
      firstName: portalToken.client.firstName,
      lastName: portalToken.client.lastName,
      orgId: portalToken.client.orgId,
      organization: portalToken.client.organization,
    },
    messageId: portalToken.messageId,
    expiresAt: portalToken.expiresAt,
  };
}

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Revoke a specific token
 */
export async function revokePortalToken(token: string): Promise<void> {
  await prisma.portalToken.delete({
    where: { token },
  });
}

/**
 * Revoke all tokens for a client
 */
export async function revokeAllClientTokens(clientId: string): Promise<number> {
  const result = await prisma.portalToken.deleteMany({
    where: { clientId },
  });

  return result.count;
}

/**
 * Get all active tokens for a client (for admin viewing)
 */
export async function getClientActiveTokens(clientId: string): Promise<{
  id: string;
  messageId: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}[]> {
  return prisma.portalToken.findMany({
    where: {
      clientId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      messageId: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired tokens
 * Should be run periodically via cron job
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.portalToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}

/**
 * Get count of expired tokens (for monitoring)
 */
export async function getExpiredTokenCount(): Promise<number> {
  return prisma.portalToken.count({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

// ============================================
// UTILITIES
// ============================================

/**
 * Check if a token format is valid (doesn't check database)
 */
export function isValidTokenFormat(token: string): boolean {
  // Token should be 64 hex characters (32 bytes * 2)
  const hexRegex = /^[a-f0-9]{64}$/i;
  return hexRegex.test(token);
}

/**
 * Get remaining time until token expires
 */
export function getTokenTimeRemaining(expiresAt: Date): {
  hours: number;
  minutes: number;
  isExpired: boolean;
} {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, isExpired: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { hours, minutes, isExpired: false };
}
