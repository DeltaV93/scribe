/**
 * High-Level Encryption Service
 *
 * Provides a clean API for encryption operations across the application.
 * This service coordinates between the crypto, KMS, and key management modules.
 *
 * Use this service for:
 * - Manual encryption/decryption operations
 * - Key rotation management
 * - Encryption status checks
 * - Data migration (re-encryption)
 */

import { prisma } from "@/lib/db";
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  isEncrypted,
  generateDek,
} from "../encryption/crypto";
import {
  getOrCreateOrgDek,
  rotateOrgDek,
  listOrgKeyVersions,
  getOrgDekByVersion,
  clearKeyCache,
  getKeyCacheStatus,
} from "../encryption/key-management";
import { isKMSConfigured, getKMSStatus, verifyKey } from "../encryption/kms";

// ============================================
// TYPES
// ============================================

export interface EncryptionStatus {
  kmsConfigured: boolean;
  kmsRegion: string;
  environment: string;
  cacheStatus: {
    size: number;
    organizations: string[];
  };
}

export interface OrganizationKeyInfo {
  organizationId: string;
  hasActiveKey: boolean;
  keyVersions: {
    id: string;
    version: number;
    isActive: boolean;
    createdAt: Date;
    rotatedAt: Date | null;
  }[];
}

export interface ReEncryptionResult {
  model: string;
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

// ============================================
// ENCRYPTION OPERATIONS
// ============================================

/**
 * Encrypt a string value for an organization
 */
export async function encryptValue(
  organizationId: string,
  value: string
): Promise<string> {
  if (!value) return value;
  if (isEncrypted(value)) return value; // Already encrypted

  const dek = await getOrCreateOrgDek(organizationId);
  return encrypt(value, dek);
}

/**
 * Decrypt a string value for an organization
 */
export async function decryptValue(
  organizationId: string,
  encryptedValue: string
): Promise<string> {
  if (!encryptedValue) return encryptedValue;
  if (!isEncrypted(encryptedValue)) return encryptedValue; // Not encrypted

  const dek = await getOrCreateOrgDek(organizationId);
  return decrypt(encryptedValue, dek);
}

/**
 * Encrypt JSON data for an organization
 */
export async function encryptData<T>(
  organizationId: string,
  data: T
): Promise<string> {
  if (data === null || data === undefined) return data as unknown as string;

  const dek = await getOrCreateOrgDek(organizationId);
  return encryptJson(data, dek);
}

/**
 * Decrypt JSON data for an organization
 */
export async function decryptData<T>(
  organizationId: string,
  encryptedData: string
): Promise<T> {
  if (!encryptedData) return encryptedData as unknown as T;
  if (!isEncrypted(encryptedData)) {
    // Try to parse as JSON if not encrypted
    try {
      return JSON.parse(encryptedData) as T;
    } catch {
      return encryptedData as unknown as T;
    }
  }

  const dek = await getOrCreateOrgDek(organizationId);
  return decryptJson<T>(encryptedData, dek);
}

/**
 * Check if a value is encrypted
 */
export function isValueEncrypted(value: string): boolean {
  return isEncrypted(value);
}

// ============================================
// KEY MANAGEMENT
// ============================================

/**
 * Initialize encryption for an organization
 * Creates a new DEK if one doesn't exist
 */
export async function initializeOrgEncryption(
  organizationId: string
): Promise<void> {
  await getOrCreateOrgDek(organizationId);
  console.log(`[EncryptionService] Initialized encryption for org ${organizationId}`);
}

/**
 * Rotate the encryption key for an organization
 * Returns the old and new key versions
 */
export async function rotateOrganizationKey(
  organizationId: string
): Promise<{ oldVersion: number; newVersion: number }> {
  const result = await rotateOrgDek(organizationId);
  console.log(
    `[EncryptionService] Rotated key for org ${organizationId}: v${result.oldVersion} -> v${result.newVersion}`
  );
  return result;
}

/**
 * Get key information for an organization
 */
export async function getOrganizationKeyInfo(
  organizationId: string
): Promise<OrganizationKeyInfo> {
  const versions = await listOrgKeyVersions(organizationId);

  return {
    organizationId,
    hasActiveKey: versions.some((v) => v.isActive),
    keyVersions: versions.map((v) => ({
      id: v.id,
      version: v.keyVersion,
      isActive: v.isActive,
      createdAt: v.createdAt,
      rotatedAt: v.rotatedAt,
    })),
  };
}

// ============================================
// SYSTEM STATUS
// ============================================

/**
 * Get overall encryption system status
 */
export async function getEncryptionStatus(): Promise<EncryptionStatus> {
  const kmsStatus = getKMSStatus();
  const cacheStatus = getKeyCacheStatus();

  return {
    kmsConfigured: kmsStatus.configured,
    kmsRegion: kmsStatus.region,
    environment: process.env.NODE_ENV || "development",
    cacheStatus: {
      size: cacheStatus.size,
      organizations: cacheStatus.keys,
    },
  };
}

/**
 * Verify KMS configuration is working
 */
export async function verifyKMSConfiguration(): Promise<{
  success: boolean;
  keyId?: string;
  keyArn?: string;
  error?: string;
}> {
  if (!isKMSConfigured()) {
    return {
      success: false,
      error: "KMS is not configured (AWS_KMS_KEY_ID not set)",
    };
  }

  try {
    const keyInfo = await verifyKey();
    return {
      success: keyInfo.enabled,
      keyId: keyInfo.keyId,
      keyArn: keyInfo.keyArn,
      ...((!keyInfo.enabled) && { error: "KMS key is not enabled" }),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Clear the key cache (forces fresh key fetch)
 */
export function clearEncryptionCache(): void {
  clearKeyCache();
  console.log("[EncryptionService] Cleared encryption key cache");
}

// ============================================
// DATA MIGRATION / RE-ENCRYPTION
// ============================================

/**
 * Re-encrypt all data for an organization after key rotation
 *
 * This should be run as a background job after key rotation.
 * It reads data encrypted with the old key and re-encrypts with the new key.
 */
export async function reEncryptOrganizationData(
  organizationId: string,
  oldKeyVersion: number,
  newKeyVersion: number,
  options?: {
    batchSize?: number;
    onProgress?: (model: string, processed: number) => void;
  }
): Promise<ReEncryptionResult[]> {
  const batchSize = options?.batchSize || 100;
  const results: ReEncryptionResult[] = [];

  // Get old and new keys
  const oldDek = await getOrgDekByVersion(organizationId, oldKeyVersion);
  const newDek = await getOrgDekByVersion(organizationId, newKeyVersion);

  if (!oldDek || !newDek) {
    throw new Error("Could not retrieve keys for re-encryption");
  }

  // Re-encrypt FormSubmissions
  results.push(
    await reEncryptFormSubmissions(organizationId, oldDek, newDek, batchSize, options?.onProgress)
  );

  // Re-encrypt Notes (via client relationship)
  results.push(
    await reEncryptNotes(organizationId, oldDek, newDek, batchSize, options?.onProgress)
  );

  // Re-encrypt Calls (via client relationship)
  results.push(
    await reEncryptCalls(organizationId, oldDek, newDek, batchSize, options?.onProgress)
  );

  // Re-encrypt Messages
  results.push(
    await reEncryptMessages(organizationId, oldDek, newDek, batchSize, options?.onProgress)
  );

  return results;
}

/**
 * Re-encrypt FormSubmission records
 */
async function reEncryptFormSubmissions(
  orgId: string,
  oldDek: string,
  newDek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "FormSubmission",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const submissions = await prisma.formSubmission.findMany({
      where: { orgId },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (submissions.length === 0) {
      hasMore = false;
      break;
    }

    for (const submission of submissions) {
      try {
        const updates: Record<string, unknown> = {};

        // Re-encrypt data field
        if (submission.data && typeof submission.data === "string" && isEncrypted(submission.data)) {
          const decrypted = decryptJson(submission.data, oldDek);
          updates.data = encryptJson(decrypted, newDek);
        }

        // Re-encrypt aiExtractedData field
        if (submission.aiExtractedData && typeof submission.aiExtractedData === "string" && isEncrypted(submission.aiExtractedData as string)) {
          const decrypted = decryptJson(submission.aiExtractedData as string, oldDek);
          updates.aiExtractedData = encryptJson(decrypted, newDek);
        }

        if (Object.keys(updates).length > 0) {
          await prisma.formSubmission.update({
            where: { id: submission.id },
            data: updates,
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`FormSubmission ${submission.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = submissions[submissions.length - 1]?.id;
    onProgress?.("FormSubmission", result.processed);
  }

  return result;
}

/**
 * Re-encrypt Note records
 */
async function reEncryptNotes(
  orgId: string,
  oldDek: string,
  newDek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Note",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const notes = await prisma.note.findMany({
      where: {
        client: { orgId },
      },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (notes.length === 0) {
      hasMore = false;
      break;
    }

    for (const note of notes) {
      try {
        if (note.content && isEncrypted(note.content)) {
          const decrypted = decrypt(note.content, oldDek);
          const reEncrypted = encrypt(decrypted, newDek);

          await prisma.note.update({
            where: { id: note.id },
            data: { content: reEncrypted },
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Note ${note.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = notes[notes.length - 1]?.id;
    onProgress?.("Note", result.processed);
  }

  return result;
}

/**
 * Re-encrypt Call records
 */
async function reEncryptCalls(
  orgId: string,
  oldDek: string,
  newDek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Call",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const calls = await prisma.call.findMany({
      where: {
        client: { orgId },
      },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (calls.length === 0) {
      hasMore = false;
      break;
    }

    for (const call of calls) {
      try {
        const updates: Record<string, unknown> = {};

        // Re-encrypt transcriptRaw
        if (call.transcriptRaw && isEncrypted(call.transcriptRaw)) {
          const decrypted = decrypt(call.transcriptRaw, oldDek);
          updates.transcriptRaw = encrypt(decrypted, newDek);
        }

        // Re-encrypt JSON fields
        const jsonFields = ["transcriptJson", "extractedFields", "aiSummary", "confidenceScores"] as const;
        for (const field of jsonFields) {
          const value = call[field];
          if (value && typeof value === "string" && isEncrypted(value)) {
            const decrypted = decryptJson(value, oldDek);
            updates[field] = encryptJson(decrypted, newDek);
          }
        }

        if (Object.keys(updates).length > 0) {
          await prisma.call.update({
            where: { id: call.id },
            data: updates,
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Call ${call.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = calls[calls.length - 1]?.id;
    onProgress?.("Call", result.processed);
  }

  return result;
}

/**
 * Re-encrypt Message records
 */
async function reEncryptMessages(
  orgId: string,
  oldDek: string,
  newDek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Message",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const messages = await prisma.message.findMany({
      where: { orgId },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (messages.length === 0) {
      hasMore = false;
      break;
    }

    for (const message of messages) {
      try {
        if (message.content && isEncrypted(message.content)) {
          const decrypted = decrypt(message.content, oldDek);
          const reEncrypted = encrypt(decrypted, newDek);

          await prisma.message.update({
            where: { id: message.id },
            data: { content: reEncrypted },
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Message ${message.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = messages[messages.length - 1]?.id;
    onProgress?.("Message", result.processed);
  }

  return result;
}

// ============================================
// BULK ENCRYPTION (for initial migration)
// ============================================

/**
 * Encrypt all unencrypted data for an organization
 * Use this for initial migration from unencrypted to encrypted data
 */
export async function encryptExistingData(
  organizationId: string,
  options?: {
    batchSize?: number;
    onProgress?: (model: string, processed: number) => void;
  }
): Promise<ReEncryptionResult[]> {
  const batchSize = options?.batchSize || 100;
  const results: ReEncryptionResult[] = [];

  // Get DEK for organization
  const dek = await getOrCreateOrgDek(organizationId);

  // Encrypt FormSubmissions
  results.push(
    await encryptFormSubmissionsInitial(organizationId, dek, batchSize, options?.onProgress)
  );

  // Encrypt Notes
  results.push(
    await encryptNotesInitial(organizationId, dek, batchSize, options?.onProgress)
  );

  // Encrypt Calls
  results.push(
    await encryptCallsInitial(organizationId, dek, batchSize, options?.onProgress)
  );

  // Encrypt Messages
  results.push(
    await encryptMessagesInitial(organizationId, dek, batchSize, options?.onProgress)
  );

  return results;
}

async function encryptFormSubmissionsInitial(
  orgId: string,
  dek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "FormSubmission",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const submissions = await prisma.formSubmission.findMany({
      where: { orgId },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (submissions.length === 0) {
      hasMore = false;
      break;
    }

    for (const submission of submissions) {
      try {
        const updates: Record<string, unknown> = {};

        // Encrypt data field if not already encrypted
        if (submission.data && !(typeof submission.data === "string" && isEncrypted(submission.data))) {
          updates.data = encryptJson(submission.data, dek);
        }

        // Encrypt aiExtractedData if not already encrypted
        if (submission.aiExtractedData && !(typeof submission.aiExtractedData === "string" && isEncrypted(submission.aiExtractedData as string))) {
          updates.aiExtractedData = encryptJson(submission.aiExtractedData, dek);
        }

        if (Object.keys(updates).length > 0) {
          await prisma.formSubmission.update({
            where: { id: submission.id },
            data: updates,
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`FormSubmission ${submission.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = submissions[submissions.length - 1]?.id;
    onProgress?.("FormSubmission", result.processed);
  }

  return result;
}

async function encryptNotesInitial(
  orgId: string,
  dek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Note",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const notes = await prisma.note.findMany({
      where: { client: { orgId } },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (notes.length === 0) {
      hasMore = false;
      break;
    }

    for (const note of notes) {
      try {
        if (note.content && !isEncrypted(note.content)) {
          await prisma.note.update({
            where: { id: note.id },
            data: { content: encrypt(note.content, dek) },
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Note ${note.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = notes[notes.length - 1]?.id;
    onProgress?.("Note", result.processed);
  }

  return result;
}

async function encryptCallsInitial(
  orgId: string,
  dek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Call",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const calls = await prisma.call.findMany({
      where: { client: { orgId } },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (calls.length === 0) {
      hasMore = false;
      break;
    }

    for (const call of calls) {
      try {
        const updates: Record<string, unknown> = {};

        if (call.transcriptRaw && !isEncrypted(call.transcriptRaw)) {
          updates.transcriptRaw = encrypt(call.transcriptRaw, dek);
        }

        const jsonFields = ["transcriptJson", "extractedFields", "aiSummary", "confidenceScores"] as const;
        for (const field of jsonFields) {
          const value = call[field];
          if (value && !(typeof value === "string" && isEncrypted(value))) {
            updates[field] = encryptJson(value, dek);
          }
        }

        if (Object.keys(updates).length > 0) {
          await prisma.call.update({
            where: { id: call.id },
            data: updates,
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Call ${call.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = calls[calls.length - 1]?.id;
    onProgress?.("Call", result.processed);
  }

  return result;
}

async function encryptMessagesInitial(
  orgId: string,
  dek: string,
  batchSize: number,
  onProgress?: (model: string, processed: number) => void
): Promise<ReEncryptionResult> {
  const result: ReEncryptionResult = {
    model: "Message",
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const messages = await prisma.message.findMany({
      where: { orgId },
      take: batchSize,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
    });

    if (messages.length === 0) {
      hasMore = false;
      break;
    }

    for (const message of messages) {
      try {
        if (message.content && !isEncrypted(message.content)) {
          await prisma.message.update({
            where: { id: message.id },
            data: { content: encrypt(message.content, dek) },
          });
        }

        result.succeeded++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Message ${message.id}: ${(error as Error).message}`);
      }

      result.processed++;
    }

    cursor = messages[messages.length - 1]?.id;
    onProgress?.("Message", result.processed);
  }

  return result;
}
