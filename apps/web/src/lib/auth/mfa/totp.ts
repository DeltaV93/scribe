/**
 * TOTP (Time-based One-Time Password) Service for MFA
 *
 * Implements RFC 6238 TOTP for use with authenticator apps like
 * Google Authenticator, Authy, and 1Password.
 *
 * Security considerations:
 * - Secrets are encrypted at rest using AES-256
 * - 30-second time window with 1-step tolerance for clock drift
 * - QR codes generated server-side, never expose raw secrets to client
 */

import { OTP, generateSecret as generateOTPSecret } from "otplib";
import * as QRCode from "qrcode";
import * as crypto from "crypto";

// Create an OTP instance for verification (defaults to TOTP strategy)
const otp = new OTP();

// Configuration
const APP_NAME = "Scrybe";
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift (30 seconds each side)
const SECRET_LENGTH = 20; // 20 bytes = 160 bits of entropy
const PERIOD = 30; // 30 seconds per step (standard)

// Encryption configuration - uses AES-256-GCM for authenticated encryption
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Get encryption key from environment
 * In production, this should be a securely stored secret
 */
function getEncryptionKey(): Buffer {
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MFA_ENCRYPTION_KEY environment variable is not set");
  }

  // Key should be 32 bytes (256 bits) for AES-256
  // If provided as hex string, convert it
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }

  // If key is shorter, derive a 256-bit key using SHA-256
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a TOTP secret for storage
 */
export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a stored TOTP secret
 */
export function decryptSecret(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a new TOTP secret
 */
export function generateSecret(): string {
  return generateOTPSecret({ length: SECRET_LENGTH });
}

/**
 * Generate a QR code URL for authenticator app setup
 */
export async function generateQRCodeDataURL(
  secret: string,
  userEmail: string
): Promise<string> {
  // Generate the otpauth URL manually (RFC 6238 format)
  const otpauthURL = `otpauth://totp/${encodeURIComponent(APP_NAME)}:${encodeURIComponent(userEmail)}?secret=${secret}&issuer=${encodeURIComponent(APP_NAME)}&algorithm=SHA1&digits=6&period=30`;

  // Generate QR code as data URL
  const qrCodeDataURL = await QRCode.toDataURL(otpauthURL, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return qrCodeDataURL;
}

/**
 * Generate the manual entry key (formatted for easy input)
 */
export function formatSecretForDisplay(secret: string): string {
  // Format in groups of 4 for easier reading
  return secret.match(/.{1,4}/g)?.join(" ") || secret;
}

/**
 * Verify a TOTP code against a secret
 * Returns true if the code is valid within the allowed time window
 */
export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  // Normalize token (remove spaces, ensure 6 digits)
  const normalizedToken = token.replace(/\s/g, "").trim();

  if (!/^\d{6}$/.test(normalizedToken)) {
    return false;
  }

  try {
    // Verify using the OTP class with TOTP options
    // epochTolerance: allow 1 step (30 seconds) before/after for clock drift
    const result = await otp.verify({
      secret,
      token: normalizedToken,
      period: PERIOD,
      epochTolerance: TOTP_WINDOW * PERIOD, // 30 seconds tolerance
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Generate the current TOTP code (for testing purposes only)
 * DO NOT expose this in production APIs
 */
export async function generateCurrentTOTP(secret: string): Promise<string> {
  return otp.generate({
    secret,
    period: PERIOD,
  });
}

export interface TOTPSetupData {
  secret: string; // Raw secret (for immediate verification during setup)
  encryptedSecret: string; // Encrypted secret for storage
  qrCodeDataURL: string; // QR code image as data URL
  manualEntryKey: string; // Formatted key for manual entry
}

/**
 * Initialize MFA setup for a user
 * Returns all data needed for the setup UI
 */
export async function initializeTOTPSetup(
  userEmail: string
): Promise<TOTPSetupData> {
  const secret = generateSecret();
  const encryptedSecret = encryptSecret(secret);
  const qrCodeDataURL = await generateQRCodeDataURL(secret, userEmail);
  const manualEntryKey = formatSecretForDisplay(secret);

  return {
    secret,
    encryptedSecret,
    qrCodeDataURL,
    manualEntryKey,
  };
}

/**
 * Complete MFA setup - verify the code and return encrypted secret
 * Returns null if verification fails
 */
export async function completeTOTPSetup(
  secret: string,
  verificationCode: string
): Promise<string | null> {
  if (!(await verifyTOTP(secret, verificationCode))) {
    return null;
  }

  return encryptSecret(secret);
}

/**
 * Verify a TOTP code against an encrypted secret
 */
export async function verifyEncryptedTOTP(
  encryptedSecret: string,
  token: string
): Promise<boolean> {
  try {
    const secret = decryptSecret(encryptedSecret);
    return await verifyTOTP(secret, token);
  } catch (error) {
    console.error("Failed to decrypt secret for TOTP verification:", error);
    return false;
  }
}
