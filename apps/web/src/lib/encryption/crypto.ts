/**
 * AES-256-GCM Encryption/Decryption Module
 *
 * Provides field-level encryption for PHI (Protected Health Information)
 * using AES-256-GCM with unique IV per encryption operation.
 *
 * HIPAA Compliance:
 * - AES-256-GCM provides authenticated encryption
 * - Unique IV per operation prevents pattern analysis
 * - Auth tag prevents tampering
 */

import * as crypto from "crypto";

// ============================================
// CONSTANTS
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Encrypted data format: [IV (12 bytes)][Auth Tag (16 bytes)][Ciphertext]
const ENCRYPTED_PREFIX = "enc:v1:"; // Prefix to identify encrypted data

// ============================================
// TYPES
// ============================================

export interface EncryptionResult {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
}

export interface EncryptedData {
  version: number;
  iv: string;
  authTag: string;
  ciphertext: string;
}

// ============================================
// ENCRYPTION FUNCTIONS
// ============================================

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The data to encrypt
 * @param key - 256-bit encryption key (Buffer or base64 string)
 * @returns Base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(plaintext: string, key: Buffer | string): string {
  if (!plaintext) {
    return plaintext;
  }

  const keyBuffer = typeof key === "string" ? Buffer.from(key, "base64") : key;

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${keyBuffer.length}`
    );
  }

  // Generate unique IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine: IV + Auth Tag + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  // Return with prefix for identification
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param encryptedData - Base64-encoded encrypted data with IV and auth tag
 * @param key - 256-bit encryption key (Buffer or base64 string)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string, key: Buffer | string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  // Check if data is encrypted
  if (!isEncrypted(encryptedData)) {
    // Return as-is if not encrypted (for migration scenarios)
    return encryptedData;
  }

  const keyBuffer = typeof key === "string" ? Buffer.from(key, "base64") : key;

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${KEY_LENGTH} bytes, got ${keyBuffer.length}`
    );
  }

  // Remove prefix and decode
  const dataWithoutPrefix = encryptedData.slice(ENCRYPTED_PREFIX.length);
  const combined = Buffer.from(dataWithoutPrefix, "base64");

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a value is encrypted (has our prefix)
 */
export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypt a JSON object's specified fields
 *
 * @param obj - Object containing fields to encrypt
 * @param key - Encryption key
 * @param fieldsToEncrypt - Array of field paths to encrypt (supports nested paths like "address.street")
 * @returns Object with specified fields encrypted
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  key: Buffer | string,
  fieldsToEncrypt: string[]
): T {
  const result = JSON.parse(JSON.stringify(obj)) as T;

  for (const fieldPath of fieldsToEncrypt) {
    const value = getNestedValue(result, fieldPath);
    if (value !== undefined && value !== null) {
      const stringValue =
        typeof value === "string" ? value : JSON.stringify(value);
      const encrypted = encrypt(stringValue, key);
      setNestedValue(result, fieldPath, encrypted);
    }
  }

  return result;
}

/**
 * Decrypt a JSON object's specified fields
 *
 * @param obj - Object containing encrypted fields
 * @param key - Decryption key
 * @param fieldsToDecrypt - Array of field paths to decrypt
 * @returns Object with specified fields decrypted
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  key: Buffer | string,
  fieldsToDecrypt: string[]
): T {
  const result = JSON.parse(JSON.stringify(obj)) as T;

  for (const fieldPath of fieldsToDecrypt) {
    const value = getNestedValue(result, fieldPath);
    if (typeof value === "string" && isEncrypted(value)) {
      try {
        const decrypted = decrypt(value, key);
        // Try to parse as JSON if it was an object
        try {
          const parsed = JSON.parse(decrypted);
          setNestedValue(result, fieldPath, parsed);
        } catch {
          setNestedValue(result, fieldPath, decrypted);
        }
      } catch (error) {
        // Log error but don't fail - leave encrypted value in place
        console.error(`Failed to decrypt field ${fieldPath}:`, error);
      }
    }
  }

  return result;
}

/**
 * Encrypt entire JSON data (for fields like FormSubmission.data)
 */
export function encryptJson(data: unknown, key: Buffer | string): string {
  if (data === null || data === undefined) {
    return data as unknown as string;
  }
  const jsonString = JSON.stringify(data);
  return encrypt(jsonString, key);
}

/**
 * Decrypt JSON data
 */
export function decryptJson<T = unknown>(
  encryptedData: string,
  key: Buffer | string
): T {
  if (!encryptedData || !isEncrypted(encryptedData)) {
    // Return as-is if not encrypted
    return encryptedData as unknown as T;
  }
  const decrypted = decrypt(encryptedData, key);
  return JSON.parse(decrypted) as T;
}

/**
 * Generate a new DEK (Data Encryption Key)
 * @returns Base64-encoded 256-bit key
 */
export function generateDek(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("base64");
}

/**
 * Derive a key from a password using PBKDF2 (for testing/development)
 * In production, use KMS-managed keys
 */
export function deriveKeyFromPassword(
  password: string,
  salt: string,
  iterations: number = 100000
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, "sha256");
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set nested value in object using dot notation path
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}
