import crypto from "crypto";
import type { ScanResult, ScanStatus } from "./types";

/**
 * Virus scanning service interface
 *
 * This module provides a pluggable interface for virus scanning.
 * In production, you would integrate with services like:
 * - ClamAV (self-hosted)
 * - VirusTotal API
 * - AWS S3 Malware Scanning
 * - Cloudflare R2 with Workers
 */

// Scan configuration
export const SCAN_CONFIG = {
  // Maximum file size for scanning (larger files skip detailed scan)
  maxScanSizeBytes: 100 * 1024 * 1024, // 100MB
  // Timeout for scan operations
  timeoutMs: 60000, // 1 minute
  // Whether to quarantine infected files
  quarantineInfected: true,
};

// Known malicious signatures (simplified example)
// In production, this would be replaced by actual AV engine
const MALICIOUS_SIGNATURES = [
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", // EICAR test file
];

/**
 * Calculate file hash for integrity verification
 */
export function calculateFileHash(
  content: Buffer,
  algorithm: "sha256" | "md5" = "sha256"
): string {
  return crypto.createHash(algorithm).update(content).digest("hex");
}

/**
 * Basic file signature check
 * Verifies magic bytes match claimed MIME type
 */
export function verifyFileSignature(
  content: Buffer,
  claimedMimeType: string
): { valid: boolean; detectedType?: string; error?: string } {
  const signatures: Record<string, { magic: number[]; offset?: number }> = {
    "application/pdf": { magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
    "image/jpeg": { magic: [0xff, 0xd8, 0xff] },
    "image/png": { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    "image/gif": { magic: [0x47, 0x49, 0x46, 0x38] }, // GIF8
    "application/zip": { magic: [0x50, 0x4b, 0x03, 0x04] }, // PK
    "application/msword": { magic: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE
    "audio/mpeg": { magic: [0xff, 0xfb] }, // MP3
    "audio/wav": { magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  };

  // Check for matching signature
  for (const [mimeType, sig] of Object.entries(signatures)) {
    const offset = sig.offset || 0;
    const matches = sig.magic.every(
      (byte, index) => content[offset + index] === byte
    );

    if (matches) {
      if (mimeType === claimedMimeType) {
        return { valid: true, detectedType: mimeType };
      }

      // DOCX files are actually ZIP files
      if (
        claimedMimeType.includes("wordprocessingml") &&
        mimeType === "application/zip"
      ) {
        return { valid: true, detectedType: claimedMimeType };
      }

      return {
        valid: false,
        detectedType: mimeType,
        error: `File signature mismatch: claimed ${claimedMimeType}, detected ${mimeType}`,
      };
    }
  }

  // Plain text files don't have a magic signature
  if (claimedMimeType === "text/plain" || claimedMimeType === "text/csv") {
    return { valid: true, detectedType: claimedMimeType };
  }

  // Unknown signature - allow but note it
  return { valid: true, detectedType: "unknown" };
}

/**
 * Scan file content for malware
 *
 * In a production environment, this would integrate with a proper AV service.
 * This implementation provides basic pattern matching as a placeholder.
 */
export async function scanFile(content: Buffer): Promise<ScanResult> {
  const startTime = Date.now();

  try {
    // Check file size
    if (content.length > SCAN_CONFIG.maxScanSizeBytes) {
      return {
        status: "CLEAN",
        scannedAt: new Date(),
        scannerVersion: "basic-1.0",
      };
    }

    // Convert to string for signature checking (for text-based threats)
    const contentString = content.toString("utf8");

    // Check for known malicious signatures
    const threats: string[] = [];

    for (const signature of MALICIOUS_SIGNATURES) {
      if (contentString.includes(signature)) {
        threats.push("EICAR-Test-File");
      }
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      { pattern: /<script[^>]*>.*?<\/script>/gi, name: "Embedded JavaScript" },
      { pattern: /javascript:/gi, name: "JavaScript URI" },
      { pattern: /data:text\/html/gi, name: "Data URI HTML" },
      { pattern: /vbscript:/gi, name: "VBScript URI" },
    ];

    // Only check for dangerous patterns in document types
    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(contentString)) {
        threats.push(name);
      }
    }

    const status: ScanStatus = threats.length > 0 ? "INFECTED" : "CLEAN";

    return {
      status,
      threats: threats.length > 0 ? threats : undefined,
      scannedAt: new Date(),
      scannerVersion: "basic-1.0",
    };
  } catch (error) {
    console.error("Scan error:", error);
    return {
      status: "ERROR",
      scannedAt: new Date(),
      error: error instanceof Error ? error.message : "Scan failed",
    };
  }
}

/**
 * Perform a quick hash-based scan
 * Checks file hash against known malware hashes
 */
export async function quickHashScan(
  content: Buffer
): Promise<{ clean: boolean; matchedHash?: string }> {
  const hash = calculateFileHash(content, "sha256");

  // Known malware hashes (in production, this would be a large database)
  const knownMalwareHashes = new Set([
    "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f", // EICAR SHA256
  ]);

  if (knownMalwareHashes.has(hash)) {
    return { clean: false, matchedHash: hash };
  }

  return { clean: true };
}

/**
 * Full file scan pipeline
 */
export async function performFullScan(
  content: Buffer,
  mimeType: string
): Promise<ScanResult> {
  // Step 1: Verify file signature
  const signatureCheck = verifyFileSignature(content, mimeType);
  if (!signatureCheck.valid) {
    return {
      status: "INFECTED",
      threats: ["File signature mismatch - possible spoofing"],
      scannedAt: new Date(),
      error: signatureCheck.error,
    };
  }

  // Step 2: Quick hash scan
  const hashScan = await quickHashScan(content);
  if (!hashScan.clean) {
    return {
      status: "INFECTED",
      threats: ["Known malware hash detected"],
      scannedAt: new Date(),
    };
  }

  // Step 3: Full content scan
  return scanFile(content);
}
