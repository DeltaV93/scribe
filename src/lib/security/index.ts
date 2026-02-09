/**
 * Security Module
 *
 * Provides breach detection, anomaly monitoring, and alert services
 * for HIPAA/SOC2 compliance.
 *
 * Main features:
 * - Threshold-based monitoring (exports, client views, failed logins)
 * - Anomaly detection (off-hours access, geographic anomalies, etc.)
 * - Risk score calculation (0-100)
 * - Automatic alerting for high-risk activities
 *
 * Usage:
 * ```typescript
 * import { evaluateSecurityRisk, shouldBlockAction } from "@/lib/security";
 *
 * // Evaluate risk for an action
 * const result = await evaluateSecurityRisk(userId, orgId, "EXPORT", ip);
 * if (result.riskLevel === "CRITICAL") {
 *   // Handle critical risk
 * }
 *
 * // Quick check to block suspicious actions
 * const { blocked, reason } = await shouldBlockAction(userId, orgId, "DOWNLOAD", ip);
 * if (blocked) {
 *   return res.status(403).json({ error: reason });
 * }
 * ```
 */

// Breach Detection
export {
  // Main functions
  evaluateSecurityRisk,
  shouldBlockAction,
  checkThresholds,
  detectAnomalies,
  calculateRiskScore,

  // Login management
  checkLoginLockout,
  recordFailedLogin,
  clearFailedLogins,

  // IP utilities
  getCountryFromIP,

  // Configuration
  DEFAULT_THRESHOLDS,

  // Types
  type SecurityThresholds,
  type ThresholdViolation,
  type ThresholdType,
  type AnomalyIndicator,
  type AnomalyType,
  type RiskLevel,
  type SecurityRiskResult,
  type UserAccessPattern,
} from "./breach-detection";

// Alert Service
export {
  triggerSecurityAlert,
  sendEmergencyAlert,
  reportSecurityIncident,

  // Types
  type AlertType,
  type SecurityAlert,
  type AlertRecipient,
  type AlertResult,
} from "./alert-service";
