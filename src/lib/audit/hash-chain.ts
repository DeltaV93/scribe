import crypto from "crypto";
import type { AuditLogEntry, AuditLogCreateInput, AuditChainVerification } from "./types";

// Genesis hash for the start of the chain
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Calculate the hash for an audit log entry
 * This creates an immutable chain where each entry's hash depends on the previous
 */
export function calculateEntryHash(
  entry: Omit<AuditLogEntry, "hash">,
  previousHash: string
): string {
  const dataToHash = JSON.stringify({
    id: entry.id,
    orgId: entry.orgId,
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
    resourceName: entry.resourceName,
    details: entry.details,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    timestamp: entry.timestamp.toISOString(),
    previousHash,
  });

  return crypto.createHash("sha256").update(dataToHash).digest("hex");
}

/**
 * Verify a single entry in the chain
 */
export function verifyEntry(
  entry: AuditLogEntry,
  expectedPreviousHash: string
): boolean {
  // Check that the previous hash matches what we expect
  if (entry.previousHash !== expectedPreviousHash) {
    return false;
  }

  // Recalculate the hash and compare
  const calculatedHash = calculateEntryHash(entry, entry.previousHash);
  return calculatedHash === entry.hash;
}

/**
 * Verify the entire audit chain for an organization
 */
export function verifyChain(entries: AuditLogEntry[]): AuditChainVerification {
  if (entries.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      verifiedEntries: 0,
    };
  }

  // Sort entries by timestamp to ensure correct order
  const sortedEntries = [...entries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  let previousHash = GENESIS_HASH;
  let verifiedCount = 0;

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];

    if (!verifyEntry(entry, previousHash)) {
      return {
        valid: false,
        totalEntries: entries.length,
        verifiedEntries: verifiedCount,
        brokenAt: {
          entryId: entry.id,
          position: i,
          expectedHash: previousHash,
          actualHash: entry.previousHash,
        },
      };
    }

    previousHash = entry.hash;
    verifiedCount++;
  }

  return {
    valid: true,
    totalEntries: entries.length,
    verifiedEntries: verifiedCount,
  };
}

/**
 * Get the genesis hash for starting a new chain
 */
export function getGenesisHash(): string {
  return GENESIS_HASH;
}

/**
 * Create a signed entry that can be independently verified
 */
export function createSignedEntry(
  input: AuditLogCreateInput,
  previousHash: string
): Omit<AuditLogEntry, "id"> & { id: string } {
  const id = crypto.randomUUID();
  const timestamp = new Date();

  const entry: Omit<AuditLogEntry, "hash"> = {
    id,
    orgId: input.orgId,
    userId: input.userId || null,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    resourceName: input.resourceName,
    details: input.details || {},
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    previousHash,
    timestamp,
  };

  const hash = calculateEntryHash(entry, previousHash);

  return {
    ...entry,
    hash,
  };
}

/**
 * Generate a proof of integrity for an entry
 * This can be shared externally to prove an entry exists in the chain
 */
export function generateIntegrityProof(entry: AuditLogEntry): string {
  const proof = {
    entryId: entry.id,
    hash: entry.hash,
    previousHash: entry.previousHash,
    timestamp: entry.timestamp.toISOString(),
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId,
  };

  const proofString = JSON.stringify(proof);
  const signature = crypto
    .createHash("sha256")
    .update(proofString)
    .digest("base64");

  return Buffer.from(JSON.stringify({ ...proof, signature })).toString("base64");
}

/**
 * Verify an integrity proof
 */
export function verifyIntegrityProof(proofString: string): {
  valid: boolean;
  data?: {
    entryId: string;
    hash: string;
    timestamp: string;
    action: string;
    resource: string;
    resourceId: string;
  };
  error?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(proofString, "base64").toString());
    const { signature, ...data } = decoded;

    const expectedSignature = crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("base64");

    if (signature !== expectedSignature) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, data };
  } catch {
    return { valid: false, error: "Invalid proof format" };
  }
}
