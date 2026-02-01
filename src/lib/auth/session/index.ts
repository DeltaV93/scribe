/**
 * Session Management Module
 *
 * Provides comprehensive session management including:
 * - Session timeout with configurable duration (15-60 minutes, default 30)
 * - Warning modal 5 minutes before expiry
 * - Heartbeat every 5 minutes to refresh active sessions
 * - Max 3 concurrent sessions per user (configurable per org)
 * - Session invalidation on password/MFA changes
 */

// Types
export {
  type Session,
  type DeviceInfo,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionTimeoutConfig,
  type SessionTimeoutStatus,
  type ConcurrentSessionConfig,
  type ConcurrentSessionCheckResult,
  type SessionSummary,
  type SessionInvalidationEvent,
  type HeartbeatResponse,
  type SessionListResponse,
  type TerminateSessionResponse,
  type TerminateAllSessionsResponse,
  SessionInvalidationReason,
  DEFAULT_SESSION_CONFIG,
  SESSION_TIMEOUT_LIMITS,
  DEFAULT_CONCURRENT_CONFIG,
  CONCURRENT_SESSION_LIMITS,
  DEFAULT_ACTIVITY_TRACKER_CONFIG,
  parseUserAgent,
  generateSessionToken,
  calculateExpiresAt,
  isSessionExpired,
  getRemainingSeconds,
} from "./types";

// Session Timeout Logic
export {
  createSession,
  getSessionByToken,
  getSessionById,
  getActiveSessionsForUser,
  getSessionSummaries,
  refreshSession,
  checkSessionTimeout,
  terminateSession,
  terminateAllOtherSessions,
  terminateAllSessions,
  cleanupExpiredSessions,
  cleanupAllExpiredSessions,
  validateTimeoutConfig,
} from "./timeout";

// Concurrent Session Management
export {
  checkConcurrentSessions,
  getMaxConcurrentSessions,
  updateMaxConcurrentSessions,
  invalidateSessionsOnPasswordChange,
  invalidateSessionsOnMfaChange,
  adminRevokeAllSessions,
  listUserSessions,
  terminateSessionById,
  terminateOtherSessions,
  checkSuspiciousActivity,
  getSessionStats,
} from "./concurrent-sessions";

// Client-side Activity Tracking (only available in client components)
// Note: Import these from "./activity-tracker" in client components:
// - useActivityTracker
// - ActivityTrackerProvider
// - useActivityTrackerContext
// - formatRemainingTime
// - getActivityEventType
