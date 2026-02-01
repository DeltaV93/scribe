/**
 * Prisma Field Encryption Middleware
 *
 * Provides transparent encryption/decryption for PHI fields in the database.
 * This middleware intercepts Prisma operations and automatically handles
 * encryption on write and decryption on read.
 *
 * Encrypted Fields:
 * - FormSubmission.data (JSON with PHI)
 * - FormSubmission.aiExtractedData (JSON with PHI)
 * - Note.content (Rich text HTML)
 * - Call.transcriptRaw (Call transcript)
 * - Call.transcriptJson (Structured transcript)
 * - Call.extractedFields (AI-extracted data)
 * - Signature.imageData (Signature image bytes - handled separately)
 * - Message.content (Message text)
 */

import { Prisma } from "@prisma/client";
import { encrypt, decrypt, encryptJson, decryptJson, isEncrypted } from "./crypto";
import { getOrCreateOrgDek } from "./key-management";

// ============================================
// CONFIGURATION
// ============================================

/**
 * Field encryption configuration
 * Maps model names to fields that should be encrypted
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

// Models that need orgId lookup from related records
const MODELS_NEEDING_ORG_LOOKUP = ["Note", "Call"];

// ============================================
// TYPES
// ============================================

type EncryptableModel = keyof typeof ENCRYPTED_FIELDS;

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
 * Usage:
 * ```
 * import { createEncryptionMiddleware } from '@/lib/encryption/field-encryption';
 * prisma.$use(createEncryptionMiddleware());
 * ```
 */
export function createEncryptionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const model = params.model as string;

    // Check if this model has encrypted fields
    if (!ENCRYPTED_FIELDS[model]) {
      return next(params);
    }

    const config = ENCRYPTED_FIELDS[model];

    // Handle writes (create, update, upsert)
    if (["create", "update", "upsert", "createMany", "updateMany"].includes(params.action)) {
      await encryptWriteData(params, config);
    }

    // Execute the query
    const result = await next(params);

    // Handle reads (findUnique, findFirst, findMany, etc.)
    if (result && ["findUnique", "findFirst", "findMany", "create", "update", "upsert"].includes(params.action)) {
      await decryptReadData(result, model, config);
    }

    return result;
  };
}

// ============================================
// ENCRYPTION HELPERS
// ============================================

/**
 * Encrypt data before writing to database
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

  // For models that need lookup (Note, Call), check if we have enough info
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
