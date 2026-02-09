/**
 * Cron Request Verification
 *
 * Provides timing-safe verification of cron requests with IP allowlisting.
 * Protects cron endpoints from unauthorized access and timing attacks.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// ============================================
// CONFIGURATION
// ============================================

/**
 * Known cron provider IP ranges.
 * These should be updated based on your deployment platform's documentation.
 *
 * Note: These are placeholder ranges. Update with actual IP ranges from:
 * - Vercel: https://vercel.com/docs/cron-jobs#cron-job-ip-allowlist
 * - Railway: https://docs.railway.app/reference/cron-jobs#ip-addresses
 * - AWS: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
 */
const VERCEL_CRON_IP_RANGES: string[] = [
  // Placeholder - update with actual Vercel cron IP ranges
  // Format: CIDR notation (e.g., "76.76.21.0/24")
  // As of 2024, Vercel cron jobs may originate from various IPs
  // Check Vercel docs for current ranges
];

const RAILWAY_CRON_IP_RANGES: string[] = [
  // Placeholder - update with actual Railway cron IP ranges
  // Railway cron jobs run from their infrastructure
];

// Combine all known cron provider IPs
const DEFAULT_CRON_IP_ALLOWLIST = [
  ...VERCEL_CRON_IP_RANGES,
  ...RAILWAY_CRON_IP_RANGES,
];

// ============================================
// IP ALLOWLIST CHECKING
// ============================================

/**
 * Parse a CIDR notation string into base IP and prefix length
 */
function parseCidr(cidr: string): { baseIp: string; prefixLength: number } | null {
  const parts = cidr.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const baseIp = parts[0];
  const prefixLength = parseInt(parts[1], 10);

  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return null;
  }

  return { baseIp, prefixLength };
}

/**
 * Convert an IPv4 address to a 32-bit number
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    result = (result << 8) + num;
  }

  // Convert to unsigned 32-bit integer
  return result >>> 0;
}

/**
 * Check if an IP address is within a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) {
    return false;
  }

  const ipNum = ipToNumber(ip);
  const baseIpNum = ipToNumber(parsed.baseIp);

  if (ipNum === null || baseIpNum === null) {
    return false;
  }

  // Create mask from prefix length
  const mask = ~((1 << (32 - parsed.prefixLength)) - 1) >>> 0;

  return (ipNum & mask) === (baseIpNum & mask);
}

/**
 * Check if an IP address is in the allowlist
 *
 * @param ip - The IP address to check
 * @param allowlist - Array of allowed IPs or CIDR ranges
 * @returns true if the IP is allowed, false otherwise
 */
export function isIpInAllowlist(ip: string | null, allowlist: string[]): boolean {
  if (!ip) {
    return false;
  }

  // Normalize the IP address
  const normalizedIp = ip.trim();

  for (const entry of allowlist) {
    // Check for exact match first
    if (entry === normalizedIp) {
      return true;
    }

    // Check CIDR range
    if (entry.includes("/") && isIpInCidr(normalizedIp, entry)) {
      return true;
    }
  }

  return false;
}

// ============================================
// IP EXTRACTION
// ============================================

/**
 * Extract client IP address from request
 *
 * Checks common headers set by proxies and load balancers.
 */
function getClientIp(request: NextRequest): string | null {
  // Check common headers for the real client IP
  // These are set by proxies/load balancers

  // Standard forwarded-for header
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  // Real IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Vercel
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0].trim();
  }

  return null;
}

// ============================================
// TOKEN VERIFICATION
// ============================================

/**
 * Timing-safe comparison of two strings
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 * Handles different length strings by returning false without leaking length info.
 */
function timingSafeTokenCompare(provided: string, expected: string): boolean {
  // Convert strings to buffers
  const providedBuffer = Buffer.from(provided, "utf-8");
  const expectedBuffer = Buffer.from(expected, "utf-8");

  // If lengths differ, we still need to do a comparison to avoid timing leaks
  // Do a comparison with the expected buffer against itself to maintain constant time
  if (providedBuffer.length !== expectedBuffer.length) {
    // Compare expected with itself to maintain timing consistency
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  // Lengths match, do actual comparison
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  // Check for Bearer prefix (case-insensitive)
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
}

// ============================================
// MAIN VERIFICATION FUNCTION
// ============================================

export interface CronVerificationOptions {
  /**
   * Whether to enforce IP allowlist checking.
   * Default: true in production, false in development
   */
  enforceIpAllowlist?: boolean;

  /**
   * Custom IP allowlist to use instead of the default.
   * Useful for testing or custom deployment configurations.
   */
  customAllowlist?: string[];

  /**
   * Whether to log warnings for rejected requests.
   * Default: true
   */
  logWarnings?: boolean;
}

export interface CronVerificationResult {
  /** Whether the request is verified */
  verified: boolean;
  /** Reason for rejection (if not verified) */
  reason?: "missing_secret" | "missing_token" | "invalid_token" | "ip_not_allowed";
  /** The client IP address (for logging) */
  clientIp: string | null;
}

/**
 * Verify a cron request using timing-safe comparison and optional IP allowlisting
 *
 * @param request - The incoming NextRequest
 * @param options - Verification options
 * @returns Verification result with status and reason
 */
export function verifyCronRequest(
  request: NextRequest,
  options: CronVerificationOptions = {}
): CronVerificationResult {
  const {
    enforceIpAllowlist = process.env.NODE_ENV === "production",
    customAllowlist,
    logWarnings = true,
  } = options;

  const clientIp = getClientIp(request);
  const cronSecret = process.env.CRON_SECRET;

  // Check if CRON_SECRET is configured
  if (!cronSecret) {
    if (logWarnings) {
      console.error("[Cron Verify] CRON_SECRET environment variable not configured");
    }
    return {
      verified: false,
      reason: "missing_secret",
      clientIp,
    };
  }

  // Extract and verify the token
  const providedToken = extractBearerToken(request);

  if (!providedToken) {
    if (logWarnings) {
      console.warn("[Cron Verify] Missing or malformed Authorization header", {
        ip: clientIp,
        path: request.nextUrl.pathname,
      });
    }
    return {
      verified: false,
      reason: "missing_token",
      clientIp,
    };
  }

  // Timing-safe token comparison
  const tokenValid = timingSafeTokenCompare(providedToken, cronSecret);

  if (!tokenValid) {
    if (logWarnings) {
      console.warn("[Cron Verify] Invalid cron token", {
        ip: clientIp,
        path: request.nextUrl.pathname,
      });
    }
    return {
      verified: false,
      reason: "invalid_token",
      clientIp,
    };
  }

  // Check IP allowlist (optional based on configuration)
  if (enforceIpAllowlist) {
    const allowlist = customAllowlist ?? DEFAULT_CRON_IP_ALLOWLIST;

    // Only enforce if allowlist has entries
    if (allowlist.length > 0 && !isIpInAllowlist(clientIp, allowlist)) {
      if (logWarnings) {
        console.warn("[Cron Verify] Request from non-allowlisted IP", {
          ip: clientIp,
          path: request.nextUrl.pathname,
        });
      }
      return {
        verified: false,
        reason: "ip_not_allowed",
        clientIp,
      };
    }
  }

  return {
    verified: true,
    clientIp,
  };
}

/**
 * Simple boolean verification function for backward compatibility
 *
 * @param request - The incoming NextRequest
 * @returns true if the request is verified, false otherwise
 */
export function verifyCronRequestSimple(request: NextRequest): boolean {
  const result = verifyCronRequest(request);
  return result.verified;
}
