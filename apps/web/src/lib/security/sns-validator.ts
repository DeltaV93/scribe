/**
 * AWS SNS Message Signature Validation
 *
 * Validates the authenticity of incoming SNS messages by verifying
 * the cryptographic signature against Amazon's public certificates.
 *
 * Security: This prevents spoofed SNS messages from unauthorized sources.
 */

import * as crypto from "crypto";
import * as https from "https";

// Cache for SNS certificates (keyed by URL)
const certCache = new Map<string, string>();
const CERT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedCert {
  cert: string;
  expiresAt: number;
}

const certCacheWithExpiry = new Map<string, CachedCert>();

/**
 * SNS Message types
 */
export type SNSMessageType =
  | "SubscriptionConfirmation"
  | "Notification"
  | "UnsubscribeConfirmation";

/**
 * SNS Message structure
 */
export interface SNSMessage {
  Type: SNSMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  UnsubscribeURL?: string;
  Subject?: string;
  Token?: string;
}

/**
 * Validation result
 */
export interface SNSValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that the SigningCertURL is from AWS SNS
 * This prevents attackers from using their own certificates
 */
function isValidCertUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Must be HTTPS
    if (parsedUrl.protocol !== "https:") {
      return false;
    }

    // Must be from AWS SNS domain
    const validDomains = [
      "sns.amazonaws.com",
      "sns.us-east-1.amazonaws.com",
      "sns.us-east-2.amazonaws.com",
      "sns.us-west-1.amazonaws.com",
      "sns.us-west-2.amazonaws.com",
      "sns.eu-west-1.amazonaws.com",
      "sns.eu-central-1.amazonaws.com",
      "sns.ap-southeast-1.amazonaws.com",
      "sns.ap-southeast-2.amazonaws.com",
      "sns.ap-northeast-1.amazonaws.com",
    ];

    const isValid = validDomains.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`)
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Fetch the signing certificate from AWS
 */
async function fetchCertificate(certUrl: string): Promise<string> {
  // Check cache first
  const cached = certCacheWithExpiry.get(certUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.cert;
  }

  return new Promise((resolve, reject) => {
    https
      .get(certUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch certificate: ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          // Cache the certificate
          certCacheWithExpiry.set(certUrl, {
            cert: data,
            expiresAt: Date.now() + CERT_CACHE_TTL_MS,
          });
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

/**
 * Build the string to sign based on message type
 * The order and fields included depend on the message type
 */
function buildStringToSign(message: SNSMessage): string {
  const fields: string[] = [];

  if (message.Type === "Notification") {
    fields.push("Message", message.Message);
    fields.push("MessageId", message.MessageId);
    if (message.Subject) {
      fields.push("Subject", message.Subject);
    }
    fields.push("Timestamp", message.Timestamp);
    fields.push("TopicArn", message.TopicArn);
    fields.push("Type", message.Type);
  } else if (
    message.Type === "SubscriptionConfirmation" ||
    message.Type === "UnsubscribeConfirmation"
  ) {
    fields.push("Message", message.Message);
    fields.push("MessageId", message.MessageId);
    fields.push("SubscribeURL", message.SubscribeURL || "");
    fields.push("Timestamp", message.Timestamp);
    fields.push("Token", message.Token || "");
    fields.push("TopicArn", message.TopicArn);
    fields.push("Type", message.Type);
  }

  // Build the canonical string with newline separators
  return fields.join("\n") + "\n";
}

/**
 * Validate an SNS message signature
 *
 * @param message - The SNS message to validate
 * @returns Validation result with error message if invalid
 */
export async function validateSNSMessage(
  message: SNSMessage
): Promise<SNSValidationResult> {
  try {
    // Verify signature version
    if (message.SignatureVersion !== "1") {
      return {
        valid: false,
        error: `Unsupported signature version: ${message.SignatureVersion}`,
      };
    }

    // Verify the certificate URL is from AWS
    if (!isValidCertUrl(message.SigningCertURL)) {
      console.warn(
        `[SNS] Invalid certificate URL: ${message.SigningCertURL}`
      );
      return {
        valid: false,
        error: "Invalid signing certificate URL - must be from AWS SNS",
      };
    }

    // Fetch the certificate
    const certificate = await fetchCertificate(message.SigningCertURL);

    // Build the string that was signed
    const stringToSign = buildStringToSign(message);

    // Decode the signature
    const signature = Buffer.from(message.Signature, "base64");

    // Verify the signature
    const verifier = crypto.createVerify("sha1WithRSAEncryption");
    verifier.update(stringToSign, "utf8");

    const isValid = verifier.verify(certificate, signature);

    if (!isValid) {
      console.warn("[SNS] Signature verification failed");
      return {
        valid: false,
        error: "Signature verification failed",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[SNS] Validation error:", error);
    return {
      valid: false,
      error: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate an SNS message from a raw request body
 */
export async function validateSNSRequest(
  body: unknown
): Promise<SNSValidationResult> {
  // Type check the body
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const message = body as SNSMessage;

  // Check required fields
  if (!message.Type || !message.Signature || !message.SigningCertURL) {
    return { valid: false, error: "Missing required SNS fields" };
  }

  return validateSNSMessage(message);
}
