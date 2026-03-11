/**
 * Trusted Device Types and Configuration
 *
 * Types for the "Remember this device" MFA feature that allows
 * users to skip MFA on trusted devices for 30 days.
 */

import type { DeviceInfo } from "../session/types";

// ============================================
// CONFIGURATION
// ============================================

export const TRUSTED_DEVICE_CONFIG = {
  /** Number of days a device stays trusted */
  expirationDays: 30,
  /** Maximum trusted devices per user (oldest auto-revoked) */
  maxDevices: 5,
  /** Cookie name for trusted device token */
  cookieName: "__inkra_td",
  /** Cookie max age in seconds (30 days) */
  cookieMaxAge: 30 * 24 * 60 * 60,
} as const;

// ============================================
// TYPES
// ============================================

export interface TrustedDeviceInfo {
  id: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  isRevoked: boolean;
}

export interface CreateTrustedDeviceInput {
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
}

export interface CreateTrustedDeviceResult {
  success: boolean;
  deviceId?: string;
  token?: string; // Plain text token to be stored in cookie
  error?: string;
}

export interface ValidateTrustedDeviceResult {
  valid: boolean;
  deviceId?: string;
  userId?: string;
  error?: string;
}

export interface RevokeTrustedDeviceResult {
  success: boolean;
  error?: string;
}

export interface ListTrustedDevicesResult {
  devices: TrustedDeviceInfo[];
  total: number;
}

// ============================================
// AUDIT EVENT TYPES
// ============================================

export type TrustedDeviceAuditEvent =
  | "TRUSTED_DEVICE_CREATED"
  | "TRUSTED_DEVICE_REVOKED"
  | "ALL_TRUSTED_DEVICES_REVOKED"
  | "MFA_SKIPPED_TRUSTED_DEVICE";
