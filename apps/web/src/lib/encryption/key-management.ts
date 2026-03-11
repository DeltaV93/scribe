/**
 * Key Management Module
 *
 * Manages Data Encryption Keys (DEKs) for each organization.
 * Each organization has its own DEK for data isolation.
 *
 * Key Hierarchy:
 * - AWS KMS Master Key (never leaves KMS)
 *   └── Organization DEK (encrypted by master key, stored in DB)
 *       └── PHI Data (encrypted by DEK)
 */

import { prisma } from "@/lib/db";
import { generateDek as generateLocalDek } from "./crypto";
import {
  generateDataKey,
  encryptDek,
  decryptDek,
  isKMSConfigured,
} from "./kms";

// ============================================
// TYPES
// ============================================

export interface EncryptionKey {
  id: string;
  organizationId: string;
  keyVersion: number;
  encryptedDek: string;
  createdAt: Date;
  rotatedAt: Date | null;
  isActive: boolean;
}

export interface DecryptedKey {
  id: string;
  organizationId: string;
  keyVersion: number;
  plaintextDek: string; // Base64-encoded - only in memory, never stored
}

// In-memory cache for decrypted keys (per-request lifecycle)
const keyCache = new Map<string, { key: string; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// DEK MANAGEMENT
// ============================================

/**
 * Get or create the active DEK for an organization
 *
 * This is the main entry point for encryption operations.
 * Returns the plaintext DEK for use in encrypt/decrypt operations.
 */
export async function getOrCreateOrgDek(organizationId: string): Promise<string> {
  // Check cache first
  const cached = keyCache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // Try to get existing active key
  const existingKey = await prisma.encryptionKey.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: {
      keyVersion: "desc",
    },
  });

  if (existingKey) {
    const plaintextDek = await decryptOrgDek(existingKey.encryptedDek);

    // Cache the key
    keyCache.set(organizationId, {
      key: plaintextDek,
      expiresAt: Date.now() + KEY_CACHE_TTL_MS,
    });

    return plaintextDek;
  }

  // No existing key - create a new one
  return createOrgDek(organizationId);
}

/**
 * Create a new DEK for an organization
 *
 * Uses KMS to generate and encrypt the key if configured,
 * otherwise generates locally (for development).
 */
export async function createOrgDek(organizationId: string): Promise<string> {
  let plaintextDek: string;
  let encryptedDek: string;

  if (isKMSConfigured()) {
    // Production: Use KMS to generate and encrypt the DEK
    const dataKey = await generateDataKey();
    plaintextDek = dataKey.plaintextKey;
    encryptedDek = dataKey.encryptedKey;
  } else {
    // Development: Generate locally and store as-is (NOT for production)
    console.warn(
      "[Encryption] KMS not configured - using local key generation. NOT SUITABLE FOR PRODUCTION."
    );
    plaintextDek = generateLocalDek();
    // In dev mode, we store the key "encrypted" with a dev prefix for identification
    encryptedDek = `dev:${plaintextDek}`;
  }

  // Determine key version
  const latestKey = await prisma.encryptionKey.findFirst({
    where: { organizationId },
    orderBy: { keyVersion: "desc" },
    select: { keyVersion: true },
  });
  const newVersion = (latestKey?.keyVersion || 0) + 1;

  // Store the encrypted DEK
  await prisma.encryptionKey.create({
    data: {
      organizationId,
      encryptedDek,
      keyVersion: newVersion,
      isActive: true,
    },
  });

  // Update organization reference
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      encryptionKeyId: organizationId, // Just a reference marker
    },
  });

  // Cache the key
  keyCache.set(organizationId, {
    key: plaintextDek,
    expiresAt: Date.now() + KEY_CACHE_TTL_MS,
  });

  console.log(
    `[Encryption] Created new DEK for organization ${organizationId}, version ${newVersion}`
  );

  return plaintextDek;
}

/**
 * Decrypt an encrypted DEK
 */
async function decryptOrgDek(encryptedDek: string): Promise<string> {
  // Check for dev mode keys
  if (encryptedDek.startsWith("dev:")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Development encryption keys cannot be used in production");
    }
    return encryptedDek.slice(4); // Remove "dev:" prefix
  }

  // Production: Use KMS to decrypt
  return decryptDek(encryptedDek);
}

/**
 * Rotate the DEK for an organization
 *
 * Creates a new key and marks the old one as inactive.
 * Existing data will be re-encrypted with the new key in a background job.
 */
export async function rotateOrgDek(organizationId: string): Promise<{
  oldVersion: number;
  newVersion: number;
}> {
  // Get current active key
  const currentKey = await prisma.encryptionKey.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: {
      keyVersion: "desc",
    },
  });

  if (!currentKey) {
    throw new Error(`No active encryption key found for organization ${organizationId}`);
  }

  const oldVersion = currentKey.keyVersion;

  // Create new key
  await createOrgDek(organizationId);

  // Mark old key as inactive (but don't delete - needed for re-encryption)
  await prisma.encryptionKey.update({
    where: { id: currentKey.id },
    data: {
      isActive: false,
      rotatedAt: new Date(),
    },
  });

  // Clear cache
  keyCache.delete(organizationId);

  // Get new version
  const newKey = await prisma.encryptionKey.findFirst({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: {
      keyVersion: "desc",
    },
    select: { keyVersion: true },
  });

  console.log(
    `[Encryption] Rotated DEK for organization ${organizationId}: v${oldVersion} -> v${newKey?.keyVersion}`
  );

  return {
    oldVersion,
    newVersion: newKey?.keyVersion || oldVersion + 1,
  };
}

/**
 * Get a specific key version for re-encryption purposes
 */
export async function getOrgDekByVersion(
  organizationId: string,
  keyVersion: number
): Promise<string | null> {
  const key = await prisma.encryptionKey.findFirst({
    where: {
      organizationId,
      keyVersion,
    },
  });

  if (!key) {
    return null;
  }

  return decryptOrgDek(key.encryptedDek);
}

/**
 * List all key versions for an organization
 */
export async function listOrgKeyVersions(
  organizationId: string
): Promise<{
  id: string;
  keyVersion: number;
  isActive: boolean;
  createdAt: Date;
  rotatedAt: Date | null;
}[]> {
  const keys = await prisma.encryptionKey.findMany({
    where: { organizationId },
    orderBy: { keyVersion: "desc" },
    select: {
      id: true,
      keyVersion: true,
      isActive: true,
      createdAt: true,
      rotatedAt: true,
    },
  });

  return keys;
}

/**
 * Clear the key cache (for testing or after key rotation)
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Get cache status (for monitoring)
 */
export function getKeyCacheStatus(): {
  size: number;
  keys: string[];
} {
  return {
    size: keyCache.size,
    keys: Array.from(keyCache.keys()),
  };
}
