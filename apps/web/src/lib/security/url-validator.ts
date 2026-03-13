import { URL } from 'url';
import dns from 'dns/promises';

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254', // AWS metadata
];

const BLOCKED_RANGES = [
  /^10\./,           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,     // 192.168.0.0/16
  /^127\./,          // 127.0.0.0/8
  /^0\./,            // 0.0.0.0/8
];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateExternalUrl(
  urlString: string,
  allowedDomains?: string[]
): Promise<UrlValidationResult> {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS (except for localhost in dev)
    if (url.protocol !== 'https:') {
      if (!(process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
        return { valid: false, error: 'Only HTTPS URLs are allowed' };
      }
    }

    // Check blocked hosts
    if (BLOCKED_HOSTS.includes(url.hostname)) {
      return { valid: false, error: 'URL points to blocked host' };
    }

    // If allowed domains specified, enforce allowlist
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return { valid: false, error: 'URL domain not in allowlist' };
      }
    }

    // Resolve hostname to check for internal IPs
    try {
      const addresses = await dns.resolve4(url.hostname);
      for (const addr of addresses) {
        if (BLOCKED_RANGES.some(range => range.test(addr))) {
          return { valid: false, error: 'URL resolves to internal IP address' };
        }
      }
    } catch {
      // DNS resolution failed - might be an IP address directly
      if (BLOCKED_RANGES.some(range => range.test(url.hostname))) {
        return { valid: false, error: 'URL points to internal IP address' };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
