import twilio from "twilio";

/**
 * Validate a Twilio webhook signature
 *
 * Note: In production environments behind a proxy/load balancer (like Railway),
 * the request.url may be the internal URL (e.g., 0.0.0.0:8080) instead of the
 * public URL. We need to use the public URL for validation since that's what
 * Twilio used to sign the request.
 */
export function validateTwilioWebhook(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    console.warn("Twilio auth token not configured, skipping validation");
    return true;
  }

  // Reconstruct the public URL if we have NEXT_PUBLIC_APP_URL set
  // This handles cases where the internal URL differs from the public URL
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
  let validationUrl = url;

  if (publicBaseUrl) {
    try {
      const originalUrl = new URL(url);
      const publicUrl = new URL(publicBaseUrl);

      // Replace the origin (protocol + host) with the public URL
      validationUrl = `${publicUrl.origin}${originalUrl.pathname}${originalUrl.search}`;
    } catch {
      // If URL parsing fails, use the original URL
      console.warn("Failed to parse URL for Twilio validation, using original");
    }
  }

  return twilio.validateRequest(authToken, signature, validationUrl, params);
}

/**
 * Create webhook URL with base URL
 */
export function createWebhookUrl(path: string, params?: Record<string, string>): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}
