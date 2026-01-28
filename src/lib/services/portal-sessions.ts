import { prisma } from "@/lib/db";
import crypto from "crypto";

// ============================================
// TYPES
// ============================================

export interface CreateSessionInput {
  clientId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PortalSessionData {
  id: string;
  clientId: string;
  sessionToken: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    orgId: string;
    organization: {
      name: string;
    };
  };
  requiresPIN: boolean;
}

export interface ValidatedSession {
  id: string;
  clientId: string;
  csrfToken: string;
  expiresAt: Date;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    orgId: string;
    organization: {
      name: string;
    };
  };
  requiresPIN: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

// Session duration: 24 hours (fixed, no rolling)
const SESSION_DURATION_HOURS = 24;

// Token lengths in bytes (hex encoded = bytes * 2)
const SESSION_TOKEN_BYTES = 32; // 64 hex chars
const CSRF_TOKEN_BYTES = 16; // 32 hex chars

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

/**
 * Generate a CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("hex");
}

/**
 * Calculate session expiry (24 hours from now)
 */
function calculateSessionExpiry(): Date {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + SESSION_DURATION_HOURS);
  return expiryDate;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new portal session for a client
 * Used after magic link validation
 */
export async function createPortalSession(
  input: CreateSessionInput
): Promise<PortalSessionData> {
  const { clientId, ipAddress, userAgent } = input;

  // Verify client exists and get details
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      organization: {
        select: { name: true },
      },
      clientPIN: {
        select: { id: true },
      },
    },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  if (client.deletedAt) {
    throw new Error("Client account no longer exists");
  }

  // Generate tokens
  const sessionToken = generateSessionToken();
  const csrfToken = generateCsrfToken();
  const expiresAt = calculateSessionExpiry();

  // Create session in database
  const session = await prisma.portalSession.create({
    data: {
      clientId,
      sessionToken,
      csrfToken,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return {
    id: session.id,
    clientId: session.clientId,
    sessionToken: session.sessionToken,
    csrfToken: session.csrfToken,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      orgId: client.orgId,
      organization: client.organization,
    },
    requiresPIN: !!client.clientPIN,
  };
}

/**
 * Validate a session token and return session data
 * Returns null if invalid or expired
 */
export async function validateSession(
  sessionToken: string
): Promise<ValidatedSession | null> {
  const session = await prisma.portalSession.findUnique({
    where: { sessionToken },
    include: {
      client: {
        include: {
          organization: {
            select: { name: true },
          },
          clientPIN: {
            select: { id: true },
          },
        },
      },
    },
  });

  // Session not found
  if (!session) {
    return null;
  }

  // Session expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.portalSession.delete({
      where: { id: session.id },
    }).catch(() => {
      // Ignore deletion errors
    });
    return null;
  }

  // Client deleted
  if (session.client.deletedAt) {
    await deleteSession(sessionToken);
    return null;
  }

  return {
    id: session.id,
    clientId: session.clientId,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    client: {
      id: session.client.id,
      firstName: session.client.firstName,
      lastName: session.client.lastName,
      phone: session.client.phone,
      orgId: session.client.orgId,
      organization: session.client.organization,
    },
    requiresPIN: !!session.client.clientPIN,
  };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionToken: string): Promise<boolean> {
  try {
    await prisma.portalSession.delete({
      where: { sessionToken },
    });
    return true;
  } catch {
    // Session might already be deleted
    return false;
  }
}

/**
 * Delete all sessions for a client
 * Used when phone number changes or for security invalidation
 */
export async function deleteClientSessions(clientId: string): Promise<number> {
  const result = await prisma.portalSession.deleteMany({
    where: { clientId },
  });
  return result.count;
}

/**
 * Get active session count for a client
 */
export async function getActiveSessionCount(clientId: string): Promise<number> {
  return prisma.portalSession.count({
    where: {
      clientId,
      expiresAt: { gt: new Date() },
    },
  });
}

// ============================================
// CLEANUP
// ============================================

/**
 * Clean up expired sessions
 * Should be run periodically via cron job
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.portalSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Get count of expired sessions (for monitoring)
 */
export async function getExpiredSessionCount(): Promise<number> {
  return prisma.portalSession.count({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}
