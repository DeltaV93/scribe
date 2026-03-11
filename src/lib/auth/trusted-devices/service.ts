/**
 * Trusted Device Service
 *
 * Manages trusted devices for the "Remember this device" MFA feature.
 * Uses HMAC-SHA256 for secure token storage.
 */

import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/service";
import { parseUserAgent, type DeviceInfo } from "../session/types";
import {
  TRUSTED_DEVICE_CONFIG,
  type TrustedDeviceInfo,
  type CreateTrustedDeviceInput,
  type CreateTrustedDeviceResult,
  type ValidateTrustedDeviceResult,
  type RevokeTrustedDeviceResult,
  type ListTrustedDevicesResult,
} from "./types";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

// ============================================
// TOKEN UTILITIES
// ============================================

/**
 * Get the trusted device secret from environment
 */
function getSecret(): string {
  const secret = process.env.TRUSTED_DEVICE_SECRET;
  if (!secret) {
    throw new Error("TRUSTED_DEVICE_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token using HMAC-SHA256
 */
function hashToken(token: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(token)
    .digest("hex");
}

/**
 * Calculate expiration date
 */
function calculateExpiresAt(): Date {
  const now = new Date();
  return new Date(now.getTime() + TRUSTED_DEVICE_CONFIG.expirationDays * 24 * 60 * 60 * 1000);
}

// ============================================
// CORE OPERATIONS
// ============================================

/**
 * Create a new trusted device record
 * Returns the plain text token to be stored in a cookie
 */
export async function createTrustedDevice(
  input: CreateTrustedDeviceInput
): Promise<CreateTrustedDeviceResult> {
  try {
    const { userId, deviceInfo, ipAddress } = input;

    // Generate token and hash
    const token = generateToken();
    const tokenHash = hashToken(token);

    // Check device limit and revoke oldest if needed
    await enforceDeviceLimit(userId);

    // Create the trusted device record
    const device = await prisma.trustedDevice.create({
      data: {
        userId,
        tokenHash,
        deviceInfo: deviceInfo as unknown as Prisma.InputJsonValue,
        ipAddress,
        expiresAt: calculateExpiresAt(),
      },
    });

    // Get user for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true, email: true },
    });

    if (user) {
      await createAuditLog({
        orgId: user.orgId,
        userId,
        action: "CREATE",
        resource: "SETTING",
        resourceId: device.id,
        resourceName: "Trusted Device",
        details: {
          event: "TRUSTED_DEVICE_CREATED",
          deviceBrowser: deviceInfo.browser,
          deviceOS: deviceInfo.os,
          deviceType: deviceInfo.device,
          ipAddress,
        },
      });
    }

    return {
      success: true,
      deviceId: device.id,
      token, // Plain text token for cookie
    };
  } catch (error) {
    console.error("Failed to create trusted device:", error);
    return {
      success: false,
      error: "Failed to create trusted device",
    };
  }
}

/**
 * Validate a trusted device token
 * Returns the device info if valid
 */
export async function validateTrustedDevice(
  token: string
): Promise<ValidateTrustedDeviceResult> {
  try {
    const tokenHash = hashToken(token);

    const device = await prisma.trustedDevice.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, orgId: true, email: true },
        },
      },
    });

    // Device not found
    if (!device) {
      return { valid: false, error: "Device not found" };
    }

    // Device revoked
    if (device.revokedAt) {
      return { valid: false, error: "Device has been revoked" };
    }

    // Device expired
    if (new Date() >= device.expiresAt) {
      return { valid: false, error: "Device trust has expired" };
    }

    // Update last used timestamp
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });

    // Log MFA skip
    await createAuditLog({
      orgId: device.user.orgId,
      userId: device.userId,
      action: "LOGIN",
      resource: "SETTING",
      resourceId: device.id,
      resourceName: "Trusted Device",
      details: {
        event: "MFA_SKIPPED_TRUSTED_DEVICE",
        deviceId: device.id,
      },
    });

    return {
      valid: true,
      deviceId: device.id,
      userId: device.userId,
    };
  } catch (error) {
    console.error("Failed to validate trusted device:", error);
    return { valid: false, error: "Validation failed" };
  }
}

/**
 * Revoke a specific trusted device
 */
export async function revokeTrustedDevice(
  deviceId: string,
  revokedBy: string
): Promise<RevokeTrustedDeviceResult> {
  try {
    const device = await prisma.trustedDevice.findUnique({
      where: { id: deviceId },
      include: {
        user: {
          select: { id: true, orgId: true, email: true },
        },
      },
    });

    if (!device) {
      return { success: false, error: "Device not found" };
    }

    // Already revoked
    if (device.revokedAt) {
      return { success: true };
    }

    // Revoke the device
    await prisma.trustedDevice.update({
      where: { id: deviceId },
      data: {
        revokedAt: new Date(),
        revokedBy,
      },
    });

    // Audit log
    await createAuditLog({
      orgId: device.user.orgId,
      userId: revokedBy,
      action: "REVOKE",
      resource: "SETTING",
      resourceId: deviceId,
      resourceName: "Trusted Device",
      details: {
        event: "TRUSTED_DEVICE_REVOKED",
        targetUserId: device.userId,
        deviceBrowser: (device.deviceInfo as unknown as DeviceInfo).browser,
        deviceOS: (device.deviceInfo as unknown as DeviceInfo).os,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to revoke trusted device:", error);
    return { success: false, error: "Failed to revoke device" };
  }
}

/**
 * Revoke all trusted devices for a user
 * Used when password or MFA settings change
 */
export async function revokeAllTrustedDevices(
  userId: string,
  revokedBy: string,
  reason: "PASSWORD_CHANGE" | "MFA_CHANGE" | "USER_REQUEST" | "ADMIN_ACTION"
): Promise<{ success: boolean; revokedCount: number }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true, email: true },
    });

    if (!user) {
      return { success: false, revokedCount: 0 };
    }

    // Count active devices before revoking
    const activeDevices = await prisma.trustedDevice.count({
      where: {
        userId,
        revokedAt: null,
      },
    });

    // Revoke all devices
    await prisma.trustedDevice.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedBy,
      },
    });

    // Audit log
    if (activeDevices > 0) {
      await createAuditLog({
        orgId: user.orgId,
        userId: revokedBy,
        action: "REVOKE",
        resource: "SETTING",
        resourceId: userId,
        resourceName: "All Trusted Devices",
        details: {
          event: "ALL_TRUSTED_DEVICES_REVOKED",
          reason,
          revokedCount: activeDevices,
          targetUserId: userId,
        },
      });
    }

    return { success: true, revokedCount: activeDevices };
  } catch (error) {
    console.error("Failed to revoke all trusted devices:", error);
    return { success: false, revokedCount: 0 };
  }
}

/**
 * List all trusted devices for a user
 */
export async function listTrustedDevices(
  userId: string,
  includeRevoked: boolean = false
): Promise<ListTrustedDevicesResult> {
  try {
    const where = includeRevoked
      ? { userId }
      : { userId, revokedAt: null };

    const devices = await prisma.trustedDevice.findMany({
      where,
      orderBy: { lastUsedAt: "desc" },
    });

    return {
      devices: devices.map((d) => ({
        id: d.id,
        deviceInfo: d.deviceInfo as unknown as DeviceInfo,
        ipAddress: d.ipAddress,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
        lastUsedAt: d.lastUsedAt,
        isRevoked: d.revokedAt !== null,
      })),
      total: devices.length,
    };
  } catch (error) {
    console.error("Failed to list trusted devices:", error);
    return { devices: [], total: 0 };
  }
}

/**
 * Get a specific trusted device by ID
 */
export async function getTrustedDevice(
  deviceId: string
): Promise<TrustedDeviceInfo | null> {
  try {
    const device = await prisma.trustedDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return null;
    }

    return {
      id: device.id,
      deviceInfo: device.deviceInfo as unknown as DeviceInfo,
      ipAddress: device.ipAddress,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt,
      lastUsedAt: device.lastUsedAt,
      isRevoked: device.revokedAt !== null,
    };
  } catch (error) {
    console.error("Failed to get trusted device:", error);
    return null;
  }
}

// ============================================
// INTERNAL UTILITIES
// ============================================

/**
 * Enforce the maximum device limit per user
 * Revokes the oldest device if limit is exceeded
 */
async function enforceDeviceLimit(userId: string): Promise<void> {
  const activeDevices = await prisma.trustedDevice.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  // If at or over limit, revoke oldest devices
  const devicesToRevoke = activeDevices.slice(
    0,
    Math.max(0, activeDevices.length - TRUSTED_DEVICE_CONFIG.maxDevices + 1)
  );

  if (devicesToRevoke.length > 0) {
    await prisma.trustedDevice.updateMany({
      where: {
        id: { in: devicesToRevoke.map((d) => d.id) },
      },
      data: {
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });
  }
}

/**
 * Check if a user has a valid trusted device
 */
export async function hasValidTrustedDevice(userId: string): Promise<boolean> {
  const count = await prisma.trustedDevice.count({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  return count > 0;
}

/**
 * Clean up expired trusted devices (for scheduled jobs)
 */
export async function cleanupExpiredDevices(): Promise<number> {
  const result = await prisma.trustedDevice.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          revokedAt: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days after revocation
          },
        },
      ],
    },
  });

  return result.count;
}

// ============================================
// COOKIE UTILITIES
// ============================================

/**
 * Get cookie options for trusted device token
 */
export function getTrustedDeviceCookieOptions() {
  return {
    name: TRUSTED_DEVICE_CONFIG.cookieName,
    maxAge: TRUSTED_DEVICE_CONFIG.cookieMaxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}

/**
 * Parse device info from request headers
 */
export function parseDeviceFromRequest(
  userAgent: string,
  ipAddress: string
): { deviceInfo: DeviceInfo; ipAddress: string } {
  return {
    deviceInfo: parseUserAgent(userAgent),
    ipAddress,
  };
}
