/**
 * AWS KMS Integration Module
 *
 * Manages master key operations using AWS Key Management Service.
 * The master key never leaves KMS - we only use it to encrypt/decrypt DEKs.
 *
 * Key Hierarchy:
 * - Master Key (in KMS) -> encrypts/decrypts DEKs
 * - DEK (Data Encryption Key) -> encrypts actual PHI data
 *
 * This provides envelope encryption, a best practice for managing encrypted data at scale.
 */

import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
  DescribeKeyCommand,
  type EncryptCommandInput,
  type DecryptCommandInput,
  type GenerateDataKeyCommandInput,
} from "@aws-sdk/client-kms";

// ============================================
// CONFIGURATION
// ============================================

const KMS_REGION = process.env.AWS_KMS_REGION || process.env.AWS_REGION || "us-west-2";
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;

// ============================================
// TYPES
// ============================================

export interface GeneratedDataKey {
  plaintextKey: string; // Base64-encoded plaintext DEK (use in memory, never store)
  encryptedKey: string; // Base64-encoded encrypted DEK (safe to store)
}

export interface KMSConfig {
  region?: string;
  keyId?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

// ============================================
// KMS CLIENT SINGLETON
// ============================================

let kmsClient: KMSClient | null = null;

/**
 * Get or create KMS client singleton
 * Lazy initialization to avoid startup issues in development
 */
function getKMSClient(config?: KMSConfig): KMSClient {
  if (!kmsClient) {
    kmsClient = new KMSClient({
      region: config?.region || KMS_REGION,
      ...(config?.credentials && { credentials: config.credentials }),
    });
  }
  return kmsClient;
}

/**
 * Reset the KMS client (useful for testing)
 */
export function resetKMSClient(): void {
  kmsClient = null;
}

// ============================================
// KMS OPERATIONS
// ============================================

/**
 * Generate a new Data Encryption Key (DEK) using KMS
 *
 * This uses envelope encryption:
 * - KMS generates a 256-bit data key
 * - Returns both plaintext (for immediate use) and encrypted (for storage)
 * - The master key never leaves KMS
 *
 * @param keyId - KMS key ID to use (defaults to env var)
 * @returns Plaintext and encrypted versions of the DEK
 */
export async function generateDataKey(keyId?: string): Promise<GeneratedDataKey> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  const params: GenerateDataKeyCommandInput = {
    KeyId: masterKeyId,
    KeySpec: "AES_256",
  };

  try {
    const command = new GenerateDataKeyCommand(params);
    const response = await client.send(command);

    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new Error("KMS did not return expected key data");
    }

    return {
      plaintextKey: Buffer.from(response.Plaintext).toString("base64"),
      encryptedKey: Buffer.from(response.CiphertextBlob).toString("base64"),
    };
  } catch (error) {
    console.error("[KMS] Failed to generate data key:", error);
    throw new Error(`Failed to generate data key: ${(error as Error).message}`);
  }
}

/**
 * Encrypt a DEK using the master key in KMS
 *
 * Used when rotating keys or initially encrypting a locally-generated DEK.
 *
 * @param plaintextKey - Base64-encoded plaintext DEK
 * @param keyId - KMS key ID to use (defaults to env var)
 * @returns Base64-encoded encrypted DEK
 */
export async function encryptDek(
  plaintextKey: string,
  keyId?: string
): Promise<string> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  const params: EncryptCommandInput = {
    KeyId: masterKeyId,
    Plaintext: Buffer.from(plaintextKey, "base64"),
  };

  try {
    const command = new EncryptCommand(params);
    const response = await client.send(command);

    if (!response.CiphertextBlob) {
      throw new Error("KMS did not return encrypted data");
    }

    return Buffer.from(response.CiphertextBlob).toString("base64");
  } catch (error) {
    console.error("[KMS] Failed to encrypt DEK:", error);
    throw new Error(`Failed to encrypt DEK: ${(error as Error).message}`);
  }
}

/**
 * Decrypt an encrypted DEK using the master key in KMS
 *
 * @param encryptedKey - Base64-encoded encrypted DEK
 * @returns Base64-encoded plaintext DEK
 */
export async function decryptDek(encryptedKey: string): Promise<string> {
  const client = getKMSClient();

  const params: DecryptCommandInput = {
    CiphertextBlob: Buffer.from(encryptedKey, "base64"),
    // KeyId is optional for decrypt - KMS determines it from the ciphertext
  };

  try {
    const command = new DecryptCommand(params);
    const response = await client.send(command);

    if (!response.Plaintext) {
      throw new Error("KMS did not return decrypted data");
    }

    return Buffer.from(response.Plaintext).toString("base64");
  } catch (error) {
    console.error("[KMS] Failed to decrypt DEK:", error);
    throw new Error(`Failed to decrypt DEK: ${(error as Error).message}`);
  }
}

/**
 * Verify that a KMS key exists and is usable
 *
 * @param keyId - KMS key ID to verify
 * @returns Key metadata if valid
 */
export async function verifyKey(keyId?: string): Promise<{
  keyId: string;
  keyArn: string;
  enabled: boolean;
  keyUsage: string;
}> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  try {
    const command = new DescribeKeyCommand({ KeyId: masterKeyId });
    const response = await client.send(command);

    if (!response.KeyMetadata) {
      throw new Error("KMS did not return key metadata");
    }

    return {
      keyId: response.KeyMetadata.KeyId || "",
      keyArn: response.KeyMetadata.Arn || "",
      enabled: response.KeyMetadata.Enabled || false,
      keyUsage: response.KeyMetadata.KeyUsage || "",
    };
  } catch (error) {
    console.error("[KMS] Failed to verify key:", error);
    throw new Error(`Failed to verify KMS key: ${(error as Error).message}`);
  }
}

/**
 * Check if KMS is properly configured
 */
export function isKMSConfigured(): boolean {
  return !!KMS_KEY_ID;
}

/**
 * Get KMS configuration status (for health checks)
 */
export function getKMSStatus(): {
  configured: boolean;
  region: string;
  keyIdSet: boolean;
} {
  return {
    configured: isKMSConfigured(),
    region: KMS_REGION,
    keyIdSet: !!KMS_KEY_ID,
  };
}
