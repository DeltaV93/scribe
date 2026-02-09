/**
 * Two-Tier Encryption Module for High-Sensitivity Fields
 *
 * Implements a dual encryption tier system for HIPAA compliance:
 *
 * Tier 1 (Standard PHI): Existing encrypted fields
 *   - FormSubmission.data, FormSubmission.aiExtractedData
 *   - Note.content
 *   - Call.transcriptRaw, Call.transcriptJson, Call.extractedFields, Call.aiSummary, Call.confidenceScores
 *   - Message.content
 *
 * Tier 2 (High-Sensitivity): Additional protection with mandatory audit logging
 *   - Client.ssn
 *   - Client.healthConditions
 *   - ClientInsurance.memberId
 *
 * Key Differences:
 * - Tier 2 fields require audit logging on EVERY decrypt operation
 * - Tier 2 fields use a distinct encryption prefix for identification
 * - Tier 2 fields are masked by default in API responses unless explicitly requested
 *
 * HIPAA/SOC2 Compliance:
 * - All Tier 2 access is logged with user ID, purpose, and timestamp
 * - Audit entries include hash-chain integrity for tamper-evidence
 * - Access logs are retained for 7+ years per HIPAA requirements
 */

import { encrypt, decrypt, isEncrypted } from "./crypto";
import { getOrCreateOrgDek } from "./key-management";
import { logEnhancedAudit } from "../audit/enhanced-logger";
import { AuditEventType, AuditSeverity } from "../audit/events";

// ============================================
// TIER CONFIGURATION
// ============================================

/**
 * Tier 1 Fields - Standard PHI encryption (existing)
 * These fields are encrypted at rest and decrypted transparently
 */
export const TIER_1_FIELDS: Record<string, string[]> = {
  FormSubmission: ["data", "aiExtractedData"],
  Note: ["content"],
  Call: ["transcriptRaw", "transcriptJson", "extractedFields", "aiSummary", "confidenceScores"],
  Message: ["content"],
};

/**
 * Tier 2 Fields - High-sensitivity fields requiring audit on every access
 * These fields have additional access controls and mandatory logging
 */
export const TIER_2_FIELDS: Record<string, string[]> = {
  Client: ["ssn", "healthConditions"],
  ClientInsurance: ["memberId"],
};

/**
 * Display names for Tier 2 fields (for audit logs)
 */
export const TIER_2_FIELD_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  Client: {
    ssn: "Social Security Number",
    healthConditions: "Health Conditions",
  },
  ClientInsurance: {
    memberId: "Insurance Member ID",
  },
};

/**
 * Masking patterns for Tier 2 fields
 */
export const TIER_2_MASKING: Record<string, Record<string, string>> = {
  Client: {
    ssn: "[SSN REDACTED]",
    healthConditions: "[HEALTH CONDITIONS REDACTED]",
  },
  ClientInsurance: {
    memberId: "[MEMBER ID REDACTED]",
  },
};

// Encrypted data prefix for Tier 2 (different from Tier 1)
const TIER_2_PREFIX = "enc:t2:v1:";

// ============================================
// TIER 2 ENCRYPTION ACTIONS
// ============================================

export enum Tier2AccessAction {
  DECRYPT_SSN = "TIER2_DECRYPT_SSN",
  DECRYPT_HEALTH_CONDITIONS = "TIER2_DECRYPT_HEALTH_CONDITIONS",
  DECRYPT_MEMBER_ID = "TIER2_DECRYPT_MEMBER_ID",
  DECRYPT_TIER2_FIELD = "TIER2_DECRYPT_FIELD",
  ENCRYPT_TIER2_FIELD = "TIER2_ENCRYPT_FIELD",
}

// ============================================
// TYPES
// ============================================

export interface Tier2DecryptResult<T> {
  data: T;
  auditId: string;
}

export interface Tier2AccessContext {
  userId: string;
  purpose: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  clientId?: string;
  recordType?: string;
  recordId?: string;
}

// ============================================
// TIER 2 ENCRYPTION FUNCTIONS
// ============================================

/**
 * Encrypt a Tier 2 (high-sensitivity) field value
 *
 * Tier 2 encryption uses the same AES-256-GCM algorithm as Tier 1,
 * but with a distinct prefix for identification. This allows the
 * decryption process to enforce mandatory audit logging.
 *
 * @param orgId - Organization ID for key lookup
 * @param data - The data to encrypt (can be any JSON-serializable value)
 * @returns Base64-encoded encrypted string with Tier 2 prefix
 */
export async function encryptTier2<T>(orgId: string, data: T): Promise<string> {
  if (data === null || data === undefined) {
    return data as unknown as string;
  }

  // Get the organization's DEK
  const dek = await getOrCreateOrgDek(orgId);

  // Serialize the data
  const serialized = typeof data === "string" ? data : JSON.stringify(data);

  // Encrypt using base crypto, then replace prefix with Tier 2 prefix
  const encrypted = encrypt(serialized, dek);

  // Replace the standard prefix with Tier 2 prefix
  // Standard prefix is "enc:v1:", Tier 2 is "enc:t2:v1:"
  const tier2Encrypted = encrypted.replace(/^enc:v1:/, TIER_2_PREFIX);

  return tier2Encrypted;
}

/**
 * Decrypt a Tier 2 (high-sensitivity) field value with mandatory audit logging
 *
 * IMPORTANT: This function ALWAYS creates an audit log entry. The audit ID
 * is returned alongside the decrypted data to allow callers to reference
 * the specific access event.
 *
 * @param orgId - Organization ID for key lookup
 * @param encrypted - The encrypted value
 * @param userId - User ID performing the decryption (required)
 * @param purpose - Business purpose for accessing the data (required)
 * @param context - Additional context for audit logging
 * @returns Object containing decrypted data and audit log ID
 * @throws Error if encrypted value is not a valid Tier 2 encrypted string
 */
export async function decryptTier2<T>(
  orgId: string,
  encrypted: string,
  userId: string,
  purpose: string,
  context?: Partial<Tier2AccessContext>
): Promise<Tier2DecryptResult<T>> {
  // Validate inputs
  if (!userId) {
    throw new Error("Tier 2 decryption requires a valid userId for audit logging");
  }
  if (!purpose) {
    throw new Error("Tier 2 decryption requires a purpose for audit logging");
  }

  // Handle null/undefined
  if (!encrypted) {
    // Still log the access attempt even for null data
    const auditEntry = await logTier2Access({
      orgId,
      userId,
      purpose,
      action: Tier2AccessAction.DECRYPT_TIER2_FIELD,
      success: true,
      wasNull: true,
      ...context,
    });
    return { data: encrypted as unknown as T, auditId: auditEntry.id };
  }

  // Check if it's Tier 2 encrypted
  if (!isTier2Encrypted(encrypted)) {
    // If not encrypted or is Tier 1, log and return as-is (migration scenario)
    const auditEntry = await logTier2Access({
      orgId,
      userId,
      purpose,
      action: Tier2AccessAction.DECRYPT_TIER2_FIELD,
      success: true,
      wasMigration: !isEncrypted(encrypted),
      ...context,
    });
    return { data: encrypted as unknown as T, auditId: auditEntry.id };
  }

  // Get the organization's DEK
  const dek = await getOrCreateOrgDek(orgId);

  // Convert Tier 2 prefix back to standard prefix for decryption
  const standardEncrypted = encrypted.replace(TIER_2_PREFIX, "enc:v1:");

  try {
    // Decrypt the data
    const decrypted = decrypt(standardEncrypted, dek);

    // Try to parse as JSON (for complex types)
    let result: T;
    try {
      result = JSON.parse(decrypted) as T;
    } catch {
      result = decrypted as unknown as T;
    }

    // Log successful access
    const auditEntry = await logTier2Access({
      orgId,
      userId,
      purpose,
      action: Tier2AccessAction.DECRYPT_TIER2_FIELD,
      success: true,
      ...context,
    });

    return { data: result, auditId: auditEntry.id };
  } catch (error) {
    // Log failed access attempt
    const auditEntry = await logTier2Access({
      orgId,
      userId,
      purpose,
      action: Tier2AccessAction.DECRYPT_TIER2_FIELD,
      success: false,
      error: (error as Error).message,
      ...context,
    });

    throw new Error(
      `Failed to decrypt Tier 2 field (audit ID: ${auditEntry.id}): ${(error as Error).message}`
    );
  }
}

/**
 * Mask a Tier 2 field value for display
 *
 * Returns a redacted placeholder string that indicates the field
 * contains sensitive data without exposing the actual value.
 *
 * @param model - The model name (e.g., "Client")
 * @param field - The field name (e.g., "ssn")
 * @param value - The actual value (used only to determine if null/undefined)
 * @returns Masked string representation
 */
export function maskTier2Field(model: string, field: string, value: unknown): string {
  // Return null/undefined as-is for proper JSON handling
  if (value === null || value === undefined) {
    return "[REDACTED]";
  }

  // Check for specific masking pattern
  const modelMasks = TIER_2_MASKING[model];
  if (modelMasks && modelMasks[field]) {
    return modelMasks[field];
  }

  // Default mask
  return "[REDACTED]";
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a model and field combination is a Tier 2 field
 *
 * @param model - The model name (e.g., "Client", "ClientInsurance")
 * @param field - The field name (e.g., "ssn", "healthConditions")
 * @returns true if the field is a Tier 2 high-sensitivity field
 */
export function isTier2Field(model: string, field: string): boolean {
  const modelFields = TIER_2_FIELDS[model];
  if (!modelFields) {
    return false;
  }
  return modelFields.includes(field);
}

/**
 * Get the masked value for a Tier 2 field
 *
 * @param model - The model name
 * @param field - The field name
 * @returns The masked placeholder string
 */
export function getTier2MaskedValue(model: string, field: string): string {
  const modelMasks = TIER_2_MASKING[model];
  if (modelMasks && modelMasks[field]) {
    return modelMasks[field];
  }
  return "[REDACTED]";
}

/**
 * Check if a value is Tier 2 encrypted
 *
 * @param value - The value to check
 * @returns true if the value has the Tier 2 encryption prefix
 */
export function isTier2Encrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(TIER_2_PREFIX);
}

/**
 * Get all Tier 2 fields for a model
 *
 * @param model - The model name
 * @returns Array of field names, or empty array if model has no Tier 2 fields
 */
export function getTier2FieldsForModel(model: string): string[] {
  return TIER_2_FIELDS[model] || [];
}

/**
 * Get all models that have Tier 2 fields
 *
 * @returns Array of model names
 */
export function getModelsWithTier2Fields(): string[] {
  return Object.keys(TIER_2_FIELDS);
}

/**
 * Get the display name for a Tier 2 field (for audit logs and UI)
 *
 * @param model - The model name
 * @param field - The field name
 * @returns Human-readable field name
 */
export function getTier2FieldDisplayName(model: string, field: string): string {
  const modelNames = TIER_2_FIELD_DISPLAY_NAMES[model];
  if (modelNames && modelNames[field]) {
    return modelNames[field];
  }
  // Default: convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================
// AUDIT LOGGING
// ============================================

interface Tier2AuditInput {
  orgId: string;
  userId: string;
  purpose: string;
  action: Tier2AccessAction;
  success: boolean;
  wasNull?: boolean;
  wasMigration?: boolean;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  clientId?: string;
  recordType?: string;
  recordId?: string;
}

/**
 * Log Tier 2 field access to the audit system
 *
 * This creates a hash-chain verified audit entry for compliance purposes.
 * The entry includes the accessing user, purpose, and outcome.
 */
async function logTier2Access(input: Tier2AuditInput): Promise<{ id: string }> {
  const auditEntry = await logEnhancedAudit({
    eventType: AuditEventType.PHI_ACCESS,
    action: input.action,
    severity: AuditSeverity.CRITICAL, // All Tier 2 access is critical
    orgId: input.orgId,
    userId: input.userId,
    resource: "Tier2PHI",
    resourceId: input.recordId || input.clientId || "unknown",
    resourceName: input.recordType || "HighSensitivityField",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    details: {
      purpose: input.purpose,
      success: input.success,
      wasNull: input.wasNull,
      wasMigration: input.wasMigration,
      error: input.error,
      sessionId: input.sessionId,
      clientId: input.clientId,
      accessTimestamp: new Date().toISOString(),
    },
  });

  return { id: auditEntry.id };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Encrypt multiple Tier 2 fields in an object
 *
 * @param orgId - Organization ID
 * @param model - The model name
 * @param data - Object containing fields to potentially encrypt
 * @returns Object with Tier 2 fields encrypted
 */
export async function encryptTier2Fields<T extends Record<string, unknown>>(
  orgId: string,
  model: string,
  data: T
): Promise<T> {
  const tier2Fields = getTier2FieldsForModel(model);
  if (tier2Fields.length === 0) {
    return data;
  }

  const result = { ...data };

  for (const field of tier2Fields) {
    if (field in result && result[field] !== null && result[field] !== undefined) {
      // Don't re-encrypt already encrypted values
      if (typeof result[field] === "string" && isTier2Encrypted(result[field] as string)) {
        continue;
      }
      (result as Record<string, unknown>)[field] = await encryptTier2(orgId, result[field]);
    }
  }

  return result;
}

/**
 * Decrypt multiple Tier 2 fields in an object with audit logging
 *
 * @param orgId - Organization ID
 * @param model - The model name
 * @param data - Object containing encrypted fields
 * @param userId - User performing the decryption
 * @param purpose - Business purpose for access
 * @param context - Additional audit context
 * @returns Object with Tier 2 fields decrypted and array of audit IDs
 */
export async function decryptTier2Fields<T extends Record<string, unknown>>(
  orgId: string,
  model: string,
  data: T,
  userId: string,
  purpose: string,
  context?: Partial<Tier2AccessContext>
): Promise<{ data: T; auditIds: string[] }> {
  const tier2Fields = getTier2FieldsForModel(model);
  if (tier2Fields.length === 0) {
    return { data, auditIds: [] };
  }

  const result = { ...data };
  const auditIds: string[] = [];

  for (const field of tier2Fields) {
    if (field in result && typeof result[field] === "string") {
      const { data: decrypted, auditId } = await decryptTier2(
        orgId,
        result[field] as string,
        userId,
        purpose,
        {
          ...context,
          recordType: `${model}.${field}`,
        }
      );
      (result as Record<string, unknown>)[field] = decrypted;
      auditIds.push(auditId);
    }
  }

  return { data: result, auditIds };
}

/**
 * Mask all Tier 2 fields in an object
 *
 * Use this when returning data that should not expose sensitive fields.
 *
 * @param model - The model name
 * @param data - Object to mask
 * @returns Object with Tier 2 fields replaced by masked values
 */
export function maskTier2Fields<T extends Record<string, unknown>>(
  model: string,
  data: T
): T {
  const tier2Fields = getTier2FieldsForModel(model);
  if (tier2Fields.length === 0) {
    return data;
  }

  const result = { ...data };

  for (const field of tier2Fields) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = maskTier2Field(model, field, result[field]);
    }
  }

  return result;
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Migrate an existing unencrypted or Tier 1 field to Tier 2 encryption
 *
 * @param orgId - Organization ID
 * @param value - The current value (unencrypted or Tier 1 encrypted)
 * @returns Tier 2 encrypted value
 */
export async function migrateTier2Field<T>(orgId: string, value: T): Promise<string | T> {
  if (value === null || value === undefined) {
    return value;
  }

  // If already Tier 2 encrypted, return as-is
  if (typeof value === "string" && isTier2Encrypted(value)) {
    return value;
  }

  // If Tier 1 encrypted, decrypt first then re-encrypt as Tier 2
  if (typeof value === "string" && isEncrypted(value)) {
    const dek = await getOrCreateOrgDek(orgId);
    const decrypted = decrypt(value, dek);
    return encryptTier2(orgId, decrypted);
  }

  // Otherwise, encrypt as Tier 2
  return encryptTier2(orgId, value);
}
