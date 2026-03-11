/**
 * Session Management Type Definitions
 */

// ============================================
// SESSION MODEL TYPES
// ============================================

export interface Session {
  id: string;
  userId: string;
  token: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
  userAgent: string;
}

export interface CreateSessionInput {
  userId: string;
  token: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  timeoutMinutes: number;
}

export interface UpdateSessionInput {
  sessionId: string;
  userId: string;
  timeoutMinutes: number;
}

// ============================================
// SESSION TIMEOUT TYPES
// ============================================

export interface SessionTimeoutConfig {
  timeoutMinutes: number;
  warningMinutes: number;
  heartbeatIntervalMs: number;
}

export const DEFAULT_SESSION_CONFIG: SessionTimeoutConfig = {
  timeoutMinutes: 30, // Default 30 minute timeout
  warningMinutes: 5, // Show warning 5 minutes before expiry
  heartbeatIntervalMs: 5 * 60 * 1000, // Heartbeat every 5 minutes
};

export const SESSION_TIMEOUT_LIMITS = {
  min: 15,
  max: 60,
} as const;

export interface SessionTimeoutStatus {
  isExpiringSoon: boolean;
  expiresAt: Date | null;
  remainingSeconds: number;
  shouldShowWarning: boolean;
}

// ============================================
// CONCURRENT SESSION TYPES
// ============================================

export interface ConcurrentSessionConfig {
  maxSessions: number;
}

export const DEFAULT_CONCURRENT_CONFIG: ConcurrentSessionConfig = {
  maxSessions: 3,
};

export const CONCURRENT_SESSION_LIMITS = {
  min: 1,
  max: 10,
} as const;

export interface ConcurrentSessionCheckResult {
  canCreateSession: boolean;
  currentSessionCount: number;
  maxAllowed: number;
  activeSessions: SessionSummary[];
}

export interface SessionSummary {
  id: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  lastActivity: Date;
  createdAt: Date;
  isCurrent: boolean;
}

// ============================================
// SESSION INVALIDATION TYPES
// ============================================

export enum SessionInvalidationReason {
  TIMEOUT = "TIMEOUT",
  USER_LOGOUT = "USER_LOGOUT",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  MFA_CHANGE = "MFA_CHANGE",
  ADMIN_REVOKED = "ADMIN_REVOKED",
  CONCURRENT_LIMIT = "CONCURRENT_LIMIT",
  SECURITY_CONCERN = "SECURITY_CONCERN",
}

export interface SessionInvalidationEvent {
  sessionId: string;
  userId: string;
  reason: SessionInvalidationReason;
  invalidatedBy?: string;
  timestamp: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface HeartbeatResponse {
  success: boolean;
  expiresAt: Date;
  remainingSeconds: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  currentSessionId: string;
}

export interface TerminateSessionResponse {
  success: boolean;
  terminatedSessionId: string;
}

export interface TerminateAllSessionsResponse {
  success: boolean;
  terminatedCount: number;
}

// ============================================
// ACTIVITY TRACKING TYPES
// ============================================

export type ActivityEventType =
  | "mouse_move"
  | "mouse_click"
  | "key_press"
  | "scroll"
  | "focus"
  | "touch";

export interface ActivityTrackerConfig {
  debounceMs: number;
  events: ActivityEventType[];
}

export const DEFAULT_ACTIVITY_TRACKER_CONFIG: ActivityTrackerConfig = {
  debounceMs: 1000, // Debounce activity events by 1 second
  events: ["mouse_move", "mouse_click", "key_press", "scroll", "focus", "touch"],
};

export interface ActivityState {
  lastActivityAt: Date;
  isActive: boolean;
  idleTimeSeconds: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse user agent string to device info
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Detect browser
  let browser = "Unknown";
  if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("edg")) {
    browser = "Edge";
  } else if (ua.includes("chrome")) {
    browser = "Chrome";
  } else if (ua.includes("safari")) {
    browser = "Safari";
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "Opera";
  }

  // Detect OS
  let os = "Unknown";
  if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("mac")) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    os = "iOS";
  }

  // Detect device type
  let device = "Desktop";
  const isMobile =
    ua.includes("mobile") ||
    ua.includes("android") ||
    ua.includes("iphone") ||
    ua.includes("ipad");

  if (ua.includes("ipad") || ua.includes("tablet")) {
    device = "Tablet";
  } else if (isMobile) {
    device = "Mobile";
  }

  return {
    browser,
    os,
    device,
    isMobile,
    userAgent,
  };
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 64;
  let token = "";

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      token += chars[array[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return token;
}

/**
 * Calculate session expiration time
 */
export function calculateExpiresAt(timeoutMinutes: number): Date {
  const now = new Date();
  return new Date(now.getTime() + timeoutMinutes * 60 * 1000);
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() >= expiresAt;
}

/**
 * Calculate remaining seconds until expiration
 */
export function getRemainingSeconds(expiresAt: Date): number {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / 1000));
}
