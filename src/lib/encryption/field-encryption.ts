/**
 * Prisma Field Encryption Middleware
 *
 * Provides transparent encryption/decryption for PHI fields in the database.
 * This middleware intercepts Prisma operations and automatically handles
 * encryption on write and decryption on read.
 *
 * Two-Tier Encryption System:
 *
 * TIER 1 (Standard PHI) - Transparent encryption/decryption:
 * - FormSubmission.data (JSON with PHI)
 * - FormSubmission.aiExtractedData (JSON with PHI)
 * - Note.content (Rich text HTML)
 * - Call.transcriptRaw (Call transcript)
 * - Call.transcriptJson (Structured transcript)
 * - Call.extractedFields (AI-extracted data)
 * - Signature.imageData (Signature image bytes - handled separately)
 * - Message.content (Message text)
 *
 * TIER 2 (High-Sensitivity PHI) - Requires audit logging on every read:
 * - Client.ssn (Social Security Number)
 * - Client.healthConditions (Health condition data)
 * - ClientInsurance.memberId (Insurance member ID)
 *
 * NOTE: Tier 2 fields are NOT handled by this middleware's automatic decryption.
 * They must be explicitly decrypted using decryptTier2() from two-tier.ts with
 * proper audit context. The middleware DOES handle Tier 2 encryption on write.
 */

import { Prisma } from "@prisma/client";
import { encrypt, decrypt, encryptJson, decryptJson, isEncrypted } from "./crypto";
import { getOrCreateOrgDek } from "./key-management";
import {
  TIER_2_FIELDS,
  encryptTier2,
  isTier2Encrypted,
} from "./two-tier";

// ============================================
// CONFIGURATION
// ============================================

/**
 * Tier 1 Field encryption configuration
 * Maps model names to fields that should be encrypted with automatic decryption
 */
export const ENCRYPTED_FIELDS: Record<string, {
  fields: string[];
  jsonFields: string[];
  orgIdPath: string;
}> = {
  FormSubmission: {
    fields: [],
    jsonFields: ["data", "aiExtractedData"],
    orgIdPath: "orgId",
  },
  Note: {
    fields: ["content"],
    jsonFields: [],
    orgIdPath: "client.orgId", // Nested - need to fetch
  },
  Call: {
    fields: ["transcriptRaw"],
    jsonFields: ["transcriptJson", "extractedFields", "aiSummary", "confidenceScores"],
    orgIdPath: "client.orgId", // Nested - need to fetch
  },
  Message: {
    fields: ["content"],
    jsonFields: [],
    orgIdPath: "orgId",
  },
};

/**
 * Tier 2 Field encryption configuration
 * Maps model names to high-sensitivity fields that require audit logging on read
 *
 * IMPORTANT: Tier 2 fields are encrypted on write but NOT automatically decrypted.
 * Use decryptTier2() from two-tier.ts to decrypt with proper audit context.
 */
export const TIER_2_ENCRYPTED_FIELDS: Record<string, {
  fields: string[];
  jsonFields: string[];
  orgIdPath: string;
}> = {
  Client: {
    fields: ["ssn"],
    jsonFields: ["healthConditions"],
    orgIdPath: "orgId",
  },
  ClientInsurance: {
    fields: ["memberId"],
    jsonFields: [],
    orgIdPath: "client.orgId", // Nested - need to fetch
  },
};

// Models that need orgId lookup from related records
const MODELS_NEEDING_ORG_LOOKUP = ["Note", "Call", "ClientInsurance"];

// ============================================
// TYPES
// ============================================

type EncryptableModel = keyof typeof ENCRYPTED_FIELDS;
type Tier2EncryptableModel = keyof typeof TIER_2_ENCRYPTED_FIELDS;

interface EncryptionContext {
  model: string;
  action: string;
  orgId?: string;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Create Prisma middleware for automatic field encryption
 *
 * This middleware handles:
 * - Tier 1 fields: Automatic encryption on write AND decryption on read
 * - Tier 2 fields: Automatic encryption on write ONLY (decryption requires explicit call with audit)
 *
 * Usage:
 * ```
 * import { createEncryptionMiddleware } from '@/lib/encryption/field-encryption';
 * prisma.$use(createEncryptionMiddleware());
 * ```
 */
export function createEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const model = params.model as string;

    const tier1Config = ENCRYPTED_FIELDS[model];
    const tier2Config = TIER_2_ENCRYPTED_FIELDS[model];

    // Check if this model has any encrypted fields
    if (!tier1Config && !tier2Config) {
      return next(params);
    }

    // Handle writes (create, update, upsert) for both tiers
    if (["create", "update", "upsert", "createMany", "updateMany"].includes(params.action)) {
      // Encrypt Tier 1 fields (if applicable)
      if (tier1Config) {
        await encryptWriteData(params, tier1Config);
      }
      // Encrypt Tier 2 fields (if applicable)
      if (tier2Config) {
        await encryptTier2WriteData(params, tier2Config);
      }
    }

    // Execute the query
    const result = await next(params);

    // Handle reads (findUnique, findFirst, findMany, etc.) - TIER 1 ONLY
    // Tier 2 fields are NOT automatically decrypted - they require explicit
    // decryption with audit context using decryptTier2()
    if (result && tier1Config && ["findUnique", "findFirst", "findMany", "create", "update", "upsert"].includes(params.action)) {
      await decryptReadData(result, model, tier1Config);
    }

    return result;
  };
}

// ============================================
// ENCRYPTION HELPERS
// ============================================

/**
 * Encrypt Tier 1 data before writing to database
 */
async function encryptWriteData(
  params: Prisma.MiddlewareParams,
  config: typeof ENCRYPTED_FIELDS[EncryptableModel]
): Promise<void> {
  const data = getWriteData(params);
  if (!data) return;

  // Get organization ID for key lookup
  const orgId = await getOrgIdForWrite(params, data);
  if (!orgId) {
    console.warn(`[Encryption] Could not determine orgId for ${params.model} write`);
    return;
  }

  // Get the DEK for this organization
  const dek = await getOrCreateOrgDek(orgId);

  // Encrypt string fields
  for (const field of config.fields) {
    if (data[field] && typeof data[field] === "string" && !isEncrypted(data[field])) {
      data[field] = encrypt(data[field], dek);
    }
  }

  // Encrypt JSON fields
  for (const field of config.jsonFields) {
    if (data[field] !== undefined && data[field] !== null) {
      // Check if it's already a string (possibly encrypted)
      if (typeof data[field] === "string" && isEncrypted(data[field])) {
        continue; // Already encrypted
      }
      data[field] = encryptJson(data[field], dek);
    }
  }
}

/**
 * Encrypt Tier 2 (high-sensitivity) data before writing to database
 *
 * Tier 2 fields use a distinct encryption format that requires explicit
 * decryption with audit context. This function handles encryption on write.
 */
async function encryptTier2WriteData(
  params: Prisma.MiddlewareParams,
  config: typeof TIER_2_ENCRYPTED_FIELDS[Tier2EncryptableModel]
): Promise<void> {
  const data = getWriteData(params);
  if (!data) return;

  // Get organization ID for key lookup
  const orgId = await getOrgIdForWrite(params, data);
  if (!orgId) {
    console.warn(`[Encryption] Could not determine orgId for ${params.model} Tier 2 write`);
    return;
  }

  // Encrypt Tier 2 string fields
  for (const field of config.fields) {
    if (data[field] && typeof data[field] === "string") {
      // Don't re-encrypt if already Tier 2 encrypted
      if (isTier2Encrypted(data[field] as string)) {
        continue;
      }
      // Don't re-encrypt if it's Tier 1 encrypted (migration case - should be handled separately)
      if (isEncrypted(data[field] as string)) {
        console.warn(`[Encryption] Tier 2 field ${params.model}.${field} has Tier 1 encryption - migration needed`);
        continue;
      }
      data[field] = await encryptTier2(orgId, data[field]);
    }
  }

  // Encrypt Tier 2 JSON fields
  for (const field of config.jsonFields) {
    if (data[field] !== undefined && data[field] !== null) {
      // Check if it's already encrypted
      if (typeof data[field] === "string" && isTier2Encrypted(data[field] as string)) {
        continue; // Already Tier 2 encrypted
      }
      if (typeof data[field] === "string" && isEncrypted(data[field] as string)) {
        console.warn(`[Encryption] Tier 2 JSON field ${params.model}.${field} has Tier 1 encryption - migration needed`);
        continue;
      }
      data[field] = await encryptTier2(orgId, data[field]);
    }
  }
}

/**
 * Decrypt data after reading from database
 */
async function decryptReadData(
  result: unknown,
  model: string,
  config: typeof ENCRYPTED_FIELDS[EncryptableModel]
): Promise<void> {
  if (!result) return;

  // Handle arrays (findMany)
  if (Array.isArray(result)) {
    for (const item of result) {
      await decryptRecord(item, model, config);
    }
    return;
  }

  // Handle single record
  await decryptRecord(result, model, config);
}

/**
 * Decrypt a single record
 */
async function decryptRecord(
  record: unknown,
  model: string,
  config: typeof ENCRYPTED_FIELDS[EncryptableModel]
): Promise<void> {
  if (!record || typeof record !== "object") return;

  const data = record as Record<string, unknown>;

  // Get organization ID
  const orgId = getOrgIdFromRecord(data, config.orgIdPath);
  if (!orgId) {
    // Can't decrypt without org context - leave encrypted
    return;
  }

  try {
    // Get the DEK for this organization
    const dek = await getOrCreateOrgDek(orgId);

    // Decrypt string fields
    for (const field of config.fields) {
      if (typeof data[field] === "string" && isEncrypted(data[field] as string)) {
        try {
          data[field] = decrypt(data[field] as string, dek);
        } catch (error) {
          console.error(`[Encryption] Failed to decrypt ${model}.${field}:`, error);
          // Leave encrypted value in place
        }
      }
    }

    // Decrypt JSON fields
    for (const field of config.jsonFields) {
      if (typeof data[field] === "string" && isEncrypted(data[field] as string)) {
        try {
          data[field] = decryptJson(data[field] as string, dek);
        } catch (error) {
          console.error(`[Encryption] Failed to decrypt ${model}.${field}:`, error);
          // Leave encrypted value in place
        }
      }
    }
  } catch (error) {
    console.error(`[Encryption] Failed to get DEK for org ${orgId}:`, error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the data object from write params
 */
function getWriteData(params: Prisma.MiddlewareParams): Record<string, unknown> | null {
  if (params.action === "create" || params.action === "update") {
    return params.args.data as Record<string, unknown>;
  }
  if (params.action === "upsert") {
    // Encrypt both create and update data
    return {
      ...params.args.create,
      ...params.args.update,
    } as Record<string, unknown>;
  }
  if (params.action === "createMany" || params.action === "updateMany") {
    // Handle batch operations - need to encrypt each item
    // For now, log a warning - batch encryption needs special handling
    console.warn(
      `[Encryption] Batch operation ${params.action} may not encrypt properly`
    );
    return null;
  }
  return null;
}

/**
 * Get organization ID for write operations
 */
async function getOrgIdForWrite(
  params: Prisma.MiddlewareParams,
  data: Record<string, unknown>
): Promise<string | null> {
  // Direct orgId on the record
  if (data.orgId && typeof data.orgId === "string") {
    return data.orgId;
  }

  // For models that need lookup (Note, Call, ClientInsurance), check if we have enough info
  if (MODELS_NEEDING_ORG_LOOKUP.includes(params.model as string)) {
    // These models get orgId from related records
    // For writes, we need the related ID to be present
    const clientId = data.clientId as string | undefined;
    if (clientId) {
      // Import prisma dynamically to avoid circular dependency
      const { prisma } = await import("@/lib/db");
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { orgId: true },
      });
      return client?.orgId || null;
    }
  }

  return null;
}

/**
 * Get organization ID from a record (for reads)
 */
function getOrgIdFromRecord(
  data: Record<string, unknown>,
  orgIdPath: string
): string | null {
  // Simple case: direct orgId
  if (orgIdPath === "orgId" && typeof data.orgId === "string") {
    return data.orgId;
  }

  // Nested path: client.orgId
  const parts = orgIdPath.split(".");
  let current: unknown = data;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return typeof current === "string" ? current : null;
}

// ============================================
// MANUAL ENCRYPTION FUNCTIONS
// ============================================

/**
 * Manually encrypt a value for a specific organization
 * Use when Prisma middleware isn't appropriate (e.g., raw queries)
 */
export async function encryptForOrg(
  orgId: string,
  value: string
): Promise<string> {
  const dek = await getOrCreateOrgDek(orgId);
  return encrypt(value, dek);
}

/**
 * Manually decrypt a value for a specific organization
 */
export async function decryptForOrg(
  orgId: string,
  encryptedValue: string
): Promise<string> {
  if (!isEncrypted(encryptedValue)) {
    return encryptedValue;
  }
  const dek = await getOrCreateOrgDek(orgId);
  return decrypt(encryptedValue, dek);
}

/**
 * Manually encrypt JSON for a specific organization
 */
export async function encryptJsonForOrg(
  orgId: string,
  data: unknown
): Promise<string> {
  const dek = await getOrCreateOrgDek(orgId);
  return encryptJson(data, dek);
}

/**
 * Manually decrypt JSON for a specific organization
 */
export async function decryptJsonForOrg<T = unknown>(
  orgId: string,
  encryptedData: string
): Promise<T> {
  if (!isEncrypted(encryptedData)) {
    return encryptedData as unknown as T;
  }
  const dek = await getOrCreateOrgDek(orgId);
  return decryptJson<T>(encryptedData, dek);
}

/**
 * Check if a value is encrypted
 */
export { isEncrypted };
