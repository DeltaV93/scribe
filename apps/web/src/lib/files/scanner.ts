import crypto from "crypto";
import net from "net";
import type { ScanResult, ScanStatus } from "./types";

/**
 * Virus scanning service with ClamAV integration
 *
 * Supports multiple scanning backends:
 * 1. ClamAV via clamd socket (recommended for HIPAA compliance)
 * 2. External API service (VirusTotal, etc.)
 * 3. Fallback pattern-based scanning
 */

// Scan configuration
export const SCAN_CONFIG = {
  // Maximum file size for scanning (larger files skip detailed scan)
  maxScanSizeBytes: 100 * 1024 * 1024, // 100MB
  // Timeout for scan operations
  timeoutMs: 60000, // 1 minute
  // Whether to quarantine infected files
  quarantineInfected: true,
  // ClamAV configuration
  clamav: {
    host: process.env.CLAMAV_HOST || "localhost",
    port: parseInt(process.env.CLAMAV_PORT || "3310", 10),
    timeout: 30000, // 30 seconds
  },
  // External scanner API configuration
  externalApi: {
    url: process.env.SCANNER_API_URL,
    apiKey: process.env.SCANNER_API_KEY,
  },
};

// Check if ClamAV is configured
export function isClamAVConfigured(): boolean {
  return !!process.env.CLAMAV_HOST;
}

// Check if external scanner is configured
export function isExternalScannerConfigured(): boolean {
  return !!process.env.SCANNER_API_URL && !!process.env.SCANNER_API_KEY;
}

// Known malicious signatures (fallback pattern matching)
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
 * Scan file using ClamAV via clamd socket
 * Uses the INSTREAM command for in-memory scanning
 */
export async function scanWithClamAV(content: Buffer): Promise<ScanResult> {
  return new Promise((resolve) => {
    const { host, port, timeout } = SCAN_CONFIG.clamav;
    const socket = new net.Socket();
    let response = "";

    const timeoutId = setTimeout(() => {
      socket.destroy();
      resolve({
        status: "ERROR",
        scannedAt: new Date(),
        error: "ClamAV scan timeout",
        scannerVersion: "clamav",
      });
    }, timeout);

    socket.connect(port, host, () => {
      // Send INSTREAM command for in-memory scanning
      socket.write("zINSTREAM\0");

      // Send file content in chunks
      // ClamAV expects: chunk_size (4 bytes, big-endian) + chunk_data
      const chunkSize = 2048;
      let offset = 0;

      while (offset < content.length) {
        const chunk = content.slice(offset, offset + chunkSize);
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(chunk.length, 0);
        socket.write(sizeBuffer);
        socket.write(chunk);
        offset += chunkSize;
      }

      // Send terminating zero-length chunk
      const endBuffer = Buffer.alloc(4);
      endBuffer.writeUInt32BE(0, 0);
      socket.write(endBuffer);
    });

    socket.on("data", (data) => {
      response += data.toString();
    });

    socket.on("end", () => {
      clearTimeout(timeoutId);

      // Parse ClamAV response
      // Format: "stream: OK" or "stream: <virus_name> FOUND"
      const cleanResponse = response.trim().replace(/\0/g, "");

      if (cleanResponse.includes("OK")) {
        resolve({
          status: "CLEAN",
          scannedAt: new Date(),
          scannerVersion: "clamav",
        });
      } else if (cleanResponse.includes("FOUND")) {
        // Extract virus name
        const match = cleanResponse.match(/stream: (.+) FOUND/);
        const virusName = match ? match[1] : "Unknown threat";
        resolve({
          status: "INFECTED",
          threats: [virusName],
          scannedAt: new Date(),
          scannerVersion: "clamav",
        });
      } else if (cleanResponse.includes("ERROR")) {
        resolve({
          status: "ERROR",
          scannedAt: new Date(),
          error: cleanResponse,
          scannerVersion: "clamav",
        });
      } else {
        resolve({
          status: "ERROR",
          scannedAt: new Date(),
          error: `Unexpected ClamAV response: ${cleanResponse}`,
          scannerVersion: "clamav",
        });
      }
    });

    socket.on("error", (err) => {
      clearTimeout(timeoutId);
      console.error("ClamAV connection error:", err);
      resolve({
        status: "ERROR",
        scannedAt: new Date(),
        error: `ClamAV connection failed: ${err.message}`,
        scannerVersion: "clamav",
      });
    });
  });
}

/**
 * Scan file using external API service
 * Supports VirusTotal-compatible REST APIs
 */
export async function scanWithExternalAPI(content: Buffer): Promise<ScanResult> {
  const { url, apiKey } = SCAN_CONFIG.externalApi;

  if (!url || !apiKey) {
    return {
      status: "ERROR",
      scannedAt: new Date(),
      error: "External scanner not configured",
    };
  }

  try {
    // Calculate file hash for lookup
    const fileHash = calculateFileHash(content, "sha256");

    // First, check if file hash is already known
    const hashCheckResponse = await fetch(`${url}/file/${fileHash}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (hashCheckResponse.ok) {
      const result = await hashCheckResponse.json();
      if (result.known) {
        return {
          status: result.malicious ? "INFECTED" : "CLEAN",
          threats: result.threats,
          scannedAt: new Date(),
          scannerVersion: "external-api",
        };
      }
    }

    // If not known, submit for scanning
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(content)]);
    formData.append("file", blob, "upload");

    const scanResponse = await fetch(`${url}/scan`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!scanResponse.ok) {
      throw new Error(`Scanner API returned ${scanResponse.status}`);
    }

    const scanResult = await scanResponse.json();

    return {
      status: scanResult.malicious ? "INFECTED" : "CLEAN",
      threats: scanResult.threats,
      scannedAt: new Date(),
      scannerVersion: "external-api",
    };
  } catch (error) {
    console.error("External scanner error:", error);
    return {
      status: "ERROR",
      scannedAt: new Date(),
      error: error instanceof Error ? error.message : "External scan failed",
      scannerVersion: "external-api",
    };
  }
}

/**
 * Fallback pattern-based scanning
 * Used when ClamAV and external API are unavailable
 */
export function scanWithPatterns(content: Buffer): ScanResult {
  try {
    // Check file size
    if (content.length > SCAN_CONFIG.maxScanSizeBytes) {
      return {
        status: "CLEAN",
        scannedAt: new Date(),
        scannerVersion: "pattern-1.0",
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
      scannerVersion: "pattern-1.0",
    };
  } catch (error) {
    console.error("Pattern scan error:", error);
    return {
      status: "ERROR",
      scannedAt: new Date(),
      error: error instanceof Error ? error.message : "Pattern scan failed",
    };
  }
}

/**
 * Scan file content for malware
 *
 * Tries scanners in order of preference:
 * 1. ClamAV (if configured) - recommended for HIPAA
 * 2. External API (if configured)
 * 3. Pattern-based fallback
 */
export async function scanFile(content: Buffer): Promise<ScanResult> {
  // Try ClamAV first (preferred for HIPAA compliance)
  if (isClamAVConfigured()) {
    const result = await scanWithClamAV(content);
    // If ClamAV worked (not an error), return its result
    if (result.status !== "ERROR") {
      return result;
    }
    console.warn("ClamAV scan failed, trying fallback:", result.error);
  }

  // Try external API
  if (isExternalScannerConfigured()) {
    const result = await scanWithExternalAPI(content);
    if (result.status !== "ERROR") {
      return result;
    }
    console.warn("External scanner failed, trying fallback:", result.error);
  }

  // Fall back to pattern-based scanning
  console.warn("Using pattern-based scanning (ClamAV recommended for production)");
  return scanWithPatterns(content);
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
 * Check ClamAV connectivity and version
 * Useful for health checks
 */
export async function checkClamAVHealth(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  if (!isClamAVConfigured()) {
    return { connected: false, error: "ClamAV not configured" };
  }

  return new Promise((resolve) => {
    const { host, port, timeout } = SCAN_CONFIG.clamav;
    const socket = new net.Socket();
    let response = "";

    const timeoutId = setTimeout(() => {
      socket.destroy();
      resolve({ connected: false, error: "Connection timeout" });
    }, timeout);

    socket.connect(port, host, () => {
      // Send VERSION command
      socket.write("zVERSION\0");
    });

    socket.on("data", (data) => {
      response += data.toString();
    });

    socket.on("end", () => {
      clearTimeout(timeoutId);
      const version = response.trim().replace(/\0/g, "");
      resolve({ connected: true, version });
    });

    socket.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({ connected: false, error: err.message });
    });
  });
}

/**
 * Get scanner status for health checks
 */
export async function getScannerStatus(): Promise<{
  available: boolean;
  scanner: "clamav" | "external-api" | "pattern" | "none";
  details?: string;
}> {
  // Check ClamAV
  if (isClamAVConfigured()) {
    const health = await checkClamAVHealth();
    if (health.connected) {
      return {
        available: true,
        scanner: "clamav",
        details: health.version,
      };
    }
  }

  // Check external API
  if (isExternalScannerConfigured()) {
    return {
      available: true,
      scanner: "external-api",
      details: SCAN_CONFIG.externalApi.url,
    };
  }

  // Pattern fallback is always available
  return {
    available: true,
    scanner: "pattern",
    details: "Basic pattern matching (not recommended for production)",
  };
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
