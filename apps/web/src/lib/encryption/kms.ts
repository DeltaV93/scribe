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
 *
 * HIPAA/SOC 2 Compliance Features:
 * - CloudTrail logging for all key operations
 * - Key aliases for easy management
 * - Environment-specific key separation (dev/staging/prod)
 * - Automatic annual key rotation (AWS-managed)
 * - Key usage metrics and monitoring
 */

import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
  GenerateDataKeyCommand,
  DescribeKeyCommand,
  GetKeyRotationStatusCommand,
  ListAliasesCommand,
  EnableKeyRotationCommand,
  CreateAliasCommand,
  type EncryptCommandInput,
  type DecryptCommandInput,
  type GenerateDataKeyCommandInput,
  type KeyMetadata,
} from "@aws-sdk/client-kms";

// ============================================
// CONFIGURATION
// ============================================

const KMS_REGION = process.env.AWS_KMS_REGION || process.env.AWS_REGION || "us-west-2";
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;
const KMS_KEY_ALIAS = process.env.AWS_KMS_KEY_ALIAS || "alias/scrybe-phi-master-key";
const NODE_ENV = process.env.NODE_ENV || "development";

// Environment-specific key alias suffixes for separation
const ENV_KEY_ALIASES: Record<string, string> = {
  development: "alias/scrybe-phi-master-key-dev",
  staging: "alias/scrybe-phi-master-key-staging",
  production: "alias/scrybe-phi-master-key-prod",
};

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

export interface KeyRotationStatus {
  keyId: string;
  rotationEnabled: boolean;
  rotationPeriodInDays?: number;
  nextRotationDate?: Date;
}

export interface KeyHealthStatus {
  keyId: string;
  keyArn: string;
  alias?: string;
  enabled: boolean;
  keyUsage: string;
  keyState: string;
  creationDate?: Date;
  rotationEnabled: boolean;
  environment: string;
  healthChecks: {
    keyExists: boolean;
    keyEnabled: boolean;
    rotationConfigured: boolean;
    canGenerateDataKey: boolean;
    canEncryptDecrypt: boolean;
  };
  lastHealthCheck: Date;
}

export interface KMSOperationMetrics {
  operation: string;
  keyId: string;
  timestamp: Date;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
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
  environment: string;
  keyAlias: string;
} {
  return {
    configured: isKMSConfigured(),
    region: KMS_REGION,
    keyIdSet: !!KMS_KEY_ID,
    environment: NODE_ENV,
    keyAlias: ENV_KEY_ALIASES[NODE_ENV] || KMS_KEY_ALIAS,
  };
}

/**
 * Get key rotation status for the master key
 *
 * @param keyId - KMS key ID to check (defaults to env var)
 * @returns Rotation configuration status
 */
export async function getKeyRotationStatus(keyId?: string): Promise<KeyRotationStatus> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  try {
    const command = new GetKeyRotationStatusCommand({ KeyId: masterKeyId });
    const response = await client.send(command);

    return {
      keyId: masterKeyId,
      rotationEnabled: response.KeyRotationEnabled || false,
      rotationPeriodInDays: response.RotationPeriodInDays,
      nextRotationDate: response.NextRotationDate,
    };
  } catch (error) {
    console.error("[KMS] Failed to get key rotation status:", error);
    throw new Error(`Failed to get key rotation status: ${(error as Error).message}`);
  }
}

/**
 * Enable automatic key rotation for the master key
 * AWS KMS rotates keys annually when enabled
 *
 * @param keyId - KMS key ID to enable rotation for
 */
export async function enableKeyRotation(keyId?: string): Promise<void> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  try {
    const command = new EnableKeyRotationCommand({ KeyId: masterKeyId });
    await client.send(command);
    console.log(`[KMS] Enabled automatic key rotation for ${masterKeyId}`);
  } catch (error) {
    console.error("[KMS] Failed to enable key rotation:", error);
    throw new Error(`Failed to enable key rotation: ${(error as Error).message}`);
  }
}

/**
 * List all aliases associated with a key
 *
 * @param keyId - KMS key ID to list aliases for
 * @returns Array of alias names
 */
export async function listKeyAliases(keyId?: string): Promise<string[]> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  try {
    const command = new ListAliasesCommand({
      KeyId: masterKeyId,
    });
    const response = await client.send(command);

    return (response.Aliases || []).map((alias) => alias.AliasName || "");
  } catch (error) {
    console.error("[KMS] Failed to list key aliases:", error);
    throw new Error(`Failed to list key aliases: ${(error as Error).message}`);
  }
}

/**
 * Create an alias for a KMS key
 *
 * @param aliasName - The alias name (must start with "alias/")
 * @param keyId - KMS key ID to alias
 */
export async function createKeyAlias(aliasName: string, keyId?: string): Promise<void> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  if (!aliasName.startsWith("alias/")) {
    aliasName = `alias/${aliasName}`;
  }

  try {
    const command = new CreateAliasCommand({
      AliasName: aliasName,
      TargetKeyId: masterKeyId,
    });
    await client.send(command);
    console.log(`[KMS] Created alias ${aliasName} for key ${masterKeyId}`);
  } catch (error) {
    console.error("[KMS] Failed to create key alias:", error);
    throw new Error(`Failed to create key alias: ${(error as Error).message}`);
  }
}

/**
 * Get the environment-specific key alias
 */
export function getEnvironmentKeyAlias(): string {
  return ENV_KEY_ALIASES[NODE_ENV] || KMS_KEY_ALIAS;
}

/**
 * Comprehensive health check for KMS key
 * Verifies key existence, state, rotation, and operational capability
 *
 * @param keyId - KMS key ID to check (defaults to env var)
 * @returns Detailed health status
 */
export async function checkKeyHealth(keyId?: string): Promise<KeyHealthStatus> {
  const client = getKMSClient();
  const masterKeyId = keyId || KMS_KEY_ID;
  const startTime = Date.now();

  if (!masterKeyId) {
    throw new Error("KMS_KEY_ID environment variable is required");
  }

  const healthChecks = {
    keyExists: false,
    keyEnabled: false,
    rotationConfigured: false,
    canGenerateDataKey: false,
    canEncryptDecrypt: false,
  };

  let keyMetadata: KeyMetadata | undefined;
  let keyAlias: string | undefined;
  let rotationEnabled = false;

  // Check 1: Key exists and get metadata
  try {
    const describeCommand = new DescribeKeyCommand({ KeyId: masterKeyId });
    const describeResponse = await client.send(describeCommand);
    keyMetadata = describeResponse.KeyMetadata;
    healthChecks.keyExists = true;
    healthChecks.keyEnabled = keyMetadata?.Enabled || false;
  } catch (error) {
    console.error("[KMS] Health check - key describe failed:", error);
  }

  // Check 2: Rotation status
  try {
    const rotationCommand = new GetKeyRotationStatusCommand({ KeyId: masterKeyId });
    const rotationResponse = await client.send(rotationCommand);
    rotationEnabled = rotationResponse.KeyRotationEnabled || false;
    healthChecks.rotationConfigured = rotationEnabled;
  } catch (error) {
    console.error("[KMS] Health check - rotation status failed:", error);
  }

  // Check 3: Get aliases
  try {
    const aliasesCommand = new ListAliasesCommand({ KeyId: masterKeyId });
    const aliasesResponse = await client.send(aliasesCommand);
    const aliases = aliasesResponse.Aliases || [];
    keyAlias = aliases.find((a) => a.AliasName?.includes("scrybe"))?.AliasName;
  } catch (error) {
    console.error("[KMS] Health check - list aliases failed:", error);
  }

  // Check 4: Can generate data key
  if (healthChecks.keyEnabled) {
    try {
      const generateCommand = new GenerateDataKeyCommand({
        KeyId: masterKeyId,
        KeySpec: "AES_256",
      });
      const generateResponse = await client.send(generateCommand);
      healthChecks.canGenerateDataKey = !!(
        generateResponse.Plaintext && generateResponse.CiphertextBlob
      );
    } catch (error) {
      console.error("[KMS] Health check - generate data key failed:", error);
    }
  }

  // Check 5: Can encrypt/decrypt
  if (healthChecks.keyEnabled) {
    try {
      const testData = Buffer.from("health-check-test", "utf8");
      const encryptCommand = new EncryptCommand({
        KeyId: masterKeyId,
        Plaintext: testData,
      });
      const encryptResponse = await client.send(encryptCommand);

      if (encryptResponse.CiphertextBlob) {
        const decryptCommand = new DecryptCommand({
          CiphertextBlob: encryptResponse.CiphertextBlob,
        });
        const decryptResponse = await client.send(decryptCommand);
        healthChecks.canEncryptDecrypt = Buffer.from(
          decryptResponse.Plaintext || []
        ).toString("utf8") === "health-check-test";
      }
    } catch (error) {
      console.error("[KMS] Health check - encrypt/decrypt failed:", error);
    }
  }

  return {
    keyId: keyMetadata?.KeyId || masterKeyId,
    keyArn: keyMetadata?.Arn || "",
    alias: keyAlias,
    enabled: keyMetadata?.Enabled || false,
    keyUsage: keyMetadata?.KeyUsage || "",
    keyState: keyMetadata?.KeyState || "Unknown",
    creationDate: keyMetadata?.CreationDate,
    rotationEnabled,
    environment: NODE_ENV,
    healthChecks,
    lastHealthCheck: new Date(),
  };
}

/**
 * Record KMS operation metrics (for monitoring/auditing)
 */
export function recordKMSMetric(metric: KMSOperationMetrics): void {
  // Log metrics in a structured format for CloudWatch/monitoring
  console.log(
    JSON.stringify({
      type: "KMS_OPERATION",
      ...metric,
      timestamp: metric.timestamp.toISOString(),
    })
  );
}

/**
 * Wrap KMS operation with metrics recording
 */
async function withMetrics<T>(
  operation: string,
  keyId: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await fn();
    recordKMSMetric({
      operation,
      keyId,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      success: true,
    });
    return result;
  } catch (error) {
    recordKMSMetric({
      operation,
      keyId,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      success: false,
      errorCode: (error as { code?: string }).code,
      errorMessage: (error as Error).message,
    });
    throw error;
  }
}
