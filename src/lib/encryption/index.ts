/**
 * Encryption Module - Public API
 *
 * This module provides application-level PHI encryption for HIPAA compliance.
 *
 * Key Features:
 * - AES-256-GCM encryption with unique IV per operation
 * - AWS KMS integration for master key management
 * - Per-organization Data Encryption Keys (DEKs)
 * - Prisma middleware for transparent encryption/decryption
 * - Key rotation support with re-encryption utilities
 *
 * Quick Start:
 * ```typescript
 * // Enable automatic encryption via Prisma middleware
 * import { createEncryptionMiddleware } from '@/lib/encryption';
 * prisma.$use(createEncryptionMiddleware());
 *
 * // Or use manual encryption
 * import { encryptValue, decryptValue } from '@/lib/services/encryption-service';
 * const encrypted = await encryptValue(orgId, 'sensitive data');
 * const decrypted = await decryptValue(orgId, encrypted);
 * ```
 */

// Core crypto operations
export {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  encryptFields,
  decryptFields,
  isEncrypted,
  generateDek,
} from "./crypto";

// AWS KMS integration
export {
  generateDataKey,
  encryptDek,
  decryptDek,
  verifyKey,
  isKMSConfigured,
  getKMSStatus,
  getKeyRotationStatus,
  enableKeyRotation,
  listKeyAliases,
  createKeyAlias,
  getEnvironmentKeyAlias,
  checkKeyHealth,
  recordKMSMetric,
} from "./kms";

// Key management
export {
  getOrCreateOrgDek,
  createOrgDek,
  rotateOrgDek,
  getOrgDekByVersion,
  listOrgKeyVersions,
  clearKeyCache,
  getKeyCacheStatus,
} from "./key-management";

// Prisma middleware
export {
  createEncryptionMiddleware,
  encryptForOrg,
  decryptForOrg,
  encryptJsonForOrg,
  decryptJsonForOrg,
  ENCRYPTED_FIELDS,
  TIER_2_ENCRYPTED_FIELDS,
} from "./field-encryption";

// Two-tier encryption for high-sensitivity fields
export {
  // Tier configuration
  TIER_1_FIELDS,
  TIER_2_FIELDS,
  TIER_2_FIELD_DISPLAY_NAMES,
  TIER_2_MASKING,
  Tier2AccessAction,
  // Core functions
  encryptTier2,
  decryptTier2,
  maskTier2Field,
  // Helper functions
  isTier2Field,
  getTier2MaskedValue,
  isTier2Encrypted,
  getTier2FieldsForModel,
  getModelsWithTier2Fields,
  getTier2FieldDisplayName,
  // Batch operations
  encryptTier2Fields,
  decryptTier2Fields,
  maskTier2Fields,
  // Migration helpers
  migrateTier2Field,
} from "./two-tier";

// Two-tier types
export type { Tier2DecryptResult, Tier2AccessContext } from "./two-tier";

// Types
export type { EncryptionResult, EncryptedData } from "./crypto";
export type {
  GeneratedDataKey,
  KMSConfig,
  KeyRotationStatus,
  KeyHealthStatus,
  KMSOperationMetrics,
} from "./kms";
export type { EncryptionKey, DecryptedKey } from "./key-management";
