/**
 * Breach Detection System
 *
 * Hybrid approach combining threshold-based monitoring and anomaly detection
 * to identify potential security breaches in real-time.
 *
 * Features:
 * - Configurable thresholds for various security-relevant actions
 * - Anomaly detection for off-hours access, geographic anomalies, etc.
 * - Risk score calculation (0-100) combining violations and anomalies
 * - Automatic alerting based on risk levels
 *
 * Risk Score Thresholds:
 * - 80+: CRITICAL alert
 * - 50-79: WARNING alert
 * - <50: Log only
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { triggerSecurityAlert } from "./alert-service";

// ============================================
// TYPES
// ============================================

export interface SecurityThresholds {
  maxExportsPerDay: number;
  maxClientViewsPerHour: number;
  maxFailedLoginsPerHour: number;
  maxBulkDownloads: number;
  bulkDownloadWindowMinutes: number;
}

export interface ThresholdViolation {
  type: ThresholdType;
  threshold: number;
  actual: number;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: Date;
}

export type ThresholdType =
  | "EXCESSIVE_EXPORTS"
  | "EXCESSIVE_CLIENT_VIEWS"
  | "EXCESSIVE_FAILED_LOGINS"
  | "BULK_DOWNLOAD";

export interface AnomalyIndicator {
  type: AnomalyType;
  confidence: number; // 0-1, how confident we are this is anomalous
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: Date;
}

export type AnomalyType =
  | "OFF_HOURS_ACCESS"
  | "GEOGRAPHIC_ANOMALY"
  | "UNUSUAL_ACCESS_PATTERN"
  | "RAPID_FIRE_REQUESTS";

export type RiskLevel = "LOW" | "MEDIUM" | "WARNING" | "CRITICAL";

export interface SecurityRiskResult {
  userId: string;
  orgId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  violations: ThresholdViolation[];
  anomalies: AnomalyIndicator[];
  timestamp: Date;
  requiresAlert: boolean;
  alertTriggered: boolean;
}

export interface UserAccessPattern {
  userId: string;
  avgDailyExports: number;
  avgDailyClientViews: number;
  typicalAccessHours: { start: number; end: number };
  knownCountries: string[];
  avgRequestsPerMinute: number;
  lastCalculated: Date;
}

// ============================================
// CONFIGURATION
// ============================================

export const DEFAULT_THRESHOLDS: SecurityThresholds = {
  maxExportsPerDay: 50,
  maxClientViewsPerHour: 100,
  maxFailedLoginsPerHour: 10,
  maxBulkDownloads: 20,
  bulkDownloadWindowMinutes: 5,
};

// Business hours: 6am - 10pm local time (configurable per org)
const DEFAULT_BUSINESS_HOURS = {
  start: 6,
  end: 22,
};

// Countries considered "unusual" if user has no history there
// This is a simple approach - in production, use a proper IP geolocation service
const HIGH_RISK_COUNTRIES = new Set<string>([
  // Add countries based on your threat model
]);

// Risk score weights
const RISK_WEIGHTS = {
  threshold: {
    EXCESSIVE_EXPORTS: 25,
    EXCESSIVE_CLIENT_VIEWS: 20,
    EXCESSIVE_FAILED_LOGINS: 30,
    BULK_DOWNLOAD: 25,
  },
  anomaly: {
    OFF_HOURS_ACCESS: 15,
    GEOGRAPHIC_ANOMALY: 25,
    UNUSUAL_ACCESS_PATTERN: 20,
    RAPID_FIRE_REQUESTS: 30,
  },
};

// ============================================
// IP TO COUNTRY LOOKUP (SIMPLE IMPLEMENTATION)
// ============================================

/**
 * Simple IP to country lookup
 *
 * In production, use a proper geolocation service like:
 * - MaxMind GeoIP2
 * - IP2Location
 * - ipstack
 *
 * This implementation provides a basic structure.
 */
export async function getCountryFromIP(ip: string): Promise<string | null> {
  // Skip localhost/private IPs
  if (isPrivateIP(ip)) {
    return "LOCAL";
  }

  try {
    // In production, replace with actual geolocation service
    // Example with free API (rate limited, not for production):
    // const response = await fetch(`https://ipapi.co/${ip}/country/`);
    // return await response.text();

    // For now, return null to indicate we need proper implementation
    // This will cause the geographic check to be skipped gracefully
    logger.debug("IP geolocation not configured, skipping geographic check", {
      ip: maskIP(ip),
    });
    return null;
  } catch (error) {
    logger.warn("Failed to get country from IP", { ip: maskIP(ip), error });
    return null;
  }
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);

  // 10.x.x.x
  if (first === 10) return true;
  // 172.16.x.x - 172.31.x.x
  if (first === 172 && second >= 16 && second <= 31) return true;
  // 192.168.x.x
  if (first === 192 && second === 168) return true;
  // 127.x.x.x (localhost)
  if (first === 127) return true;

  return false;
}

function maskIP(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return ip.substring(0, Math.min(ip.length, 10)) + "...";
}

// ============================================
// THRESHOLD CHECKING
// ============================================

/**
 * Check if any security thresholds have been violated
 */
export async function checkThresholds(
  userId: string,
  orgId: string,
  thresholds: SecurityThresholds = DEFAULT_THRESHOLDS
): Promise<ThresholdViolation[]> {
  const violations: ThresholdViolation[] = [];
  const now = new Date();

  // Check all thresholds in parallel for efficiency
  const [
    exportCount,
    clientViewCount,
    failedLoginCount,
    recentDownloads,
  ] = await Promise.all([
    countExportsToday(userId, orgId),
    countClientViewsLastHour(userId, orgId),
    countFailedLoginsLastHour(userId),
    countRecentDownloads(userId, orgId, thresholds.bulkDownloadWindowMinutes),
  ]);

  // Check excessive exports
  if (exportCount >= thresholds.maxExportsPerDay) {
    violations.push({
      type: "EXCESSIVE_EXPORTS",
      threshold: thresholds.maxExportsPerDay,
      actual: exportCount,
      severity: exportCount >= thresholds.maxExportsPerDay * 2 ? "critical" : "high",
      description: `User exported ${exportCount} items today (limit: ${thresholds.maxExportsPerDay})`,
      timestamp: now,
    });
  }

  // Check excessive client views
  if (clientViewCount >= thresholds.maxClientViewsPerHour) {
    violations.push({
      type: "EXCESSIVE_CLIENT_VIEWS",
      threshold: thresholds.maxClientViewsPerHour,
      actual: clientViewCount,
      severity: clientViewCount >= thresholds.maxClientViewsPerHour * 2 ? "high" : "medium",
      description: `User viewed ${clientViewCount} client records in the last hour (limit: ${thresholds.maxClientViewsPerHour})`,
      timestamp: now,
    });
  }

  // Check excessive failed logins
  if (failedLoginCount >= thresholds.maxFailedLoginsPerHour) {
    violations.push({
      type: "EXCESSIVE_FAILED_LOGINS",
      threshold: thresholds.maxFailedLoginsPerHour,
      actual: failedLoginCount,
      severity: failedLoginCount >= thresholds.maxFailedLoginsPerHour * 2 ? "critical" : "high",
      description: `${failedLoginCount} failed login attempts in the last hour (limit: ${thresholds.maxFailedLoginsPerHour})`,
      timestamp: now,
    });
  }

  // Check bulk downloads
  if (recentDownloads >= thresholds.maxBulkDownloads) {
    violations.push({
      type: "BULK_DOWNLOAD",
      threshold: thresholds.maxBulkDownloads,
      actual: recentDownloads,
      severity: recentDownloads >= thresholds.maxBulkDownloads * 2 ? "critical" : "high",
      description: `User downloaded ${recentDownloads} files in ${thresholds.bulkDownloadWindowMinutes} minutes (limit: ${thresholds.maxBulkDownloads})`,
      timestamp: now,
    });
  }

  return violations;
}

async function countExportsToday(userId: string, orgId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.auditLog.count({
    where: {
      orgId,
      userId,
      action: "EXPORT",
      timestamp: { gte: startOfDay },
    },
  });
}

async function countClientViewsLastHour(userId: string, orgId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return prisma.auditLog.count({
    where: {
      orgId,
      userId,
      action: "VIEW",
      resource: "CLIENT",
      timestamp: { gte: oneHourAgo },
    },
  });
}

async function countFailedLoginsLastHour(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get user email to check failed login attempts
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, email: true },
  });

  if (!user) return 0;

  // Count audit logs for failed logins
  // Note: In a real implementation, you might have a separate table for login attempts
  return prisma.auditLog.count({
    where: {
      userId,
      action: "LOGIN",
      timestamp: { gte: oneHourAgo },
      details: {
        path: ["success"],
        equals: false,
      },
    },
  });
}

async function countRecentDownloads(
  userId: string,
  orgId: string,
  windowMinutes: number
): Promise<number> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  return prisma.auditLog.count({
    where: {
      orgId,
      userId,
      action: "DOWNLOAD",
      timestamp: { gte: windowStart },
    },
  });
}

// ============================================
// ANOMALY DETECTION
// ============================================

/**
 * Detect anomalies in user behavior
 */
export async function detectAnomalies(
  userId: string,
  orgId: string,
  action: string,
  ip: string
): Promise<AnomalyIndicator[]> {
  const anomalies: AnomalyIndicator[] = [];
  const now = new Date();

  // Get user's historical access pattern for comparison
  const userPattern = await getUserAccessPattern(userId);

  // Check off-hours access
  const offHoursAnomaly = await checkOffHoursAccess(userId, orgId, now, userPattern);
  if (offHoursAnomaly) {
    anomalies.push(offHoursAnomaly);
  }

  // Check geographic anomaly
  const geoAnomaly = await checkGeographicAnomaly(userId, ip, userPattern);
  if (geoAnomaly) {
    anomalies.push(geoAnomaly);
  }

  // Check unusual access pattern
  const patternAnomaly = await checkUnusualAccessPattern(userId, orgId, action, userPattern);
  if (patternAnomaly) {
    anomalies.push(patternAnomaly);
  }

  // Check rapid-fire requests
  const rapidFireAnomaly = await checkRapidFireRequests(userId, orgId);
  if (rapidFireAnomaly) {
    anomalies.push(rapidFireAnomaly);
  }

  return anomalies;
}

async function checkOffHoursAccess(
  userId: string,
  orgId: string,
  now: Date,
  userPattern: UserAccessPattern | null
): Promise<AnomalyIndicator | null> {
  const currentHour = now.getHours();

  // Use user's typical hours if available, otherwise default business hours
  const businessHours = userPattern?.typicalAccessHours ?? DEFAULT_BUSINESS_HOURS;

  const isOffHours = currentHour < businessHours.start || currentHour >= businessHours.end;

  if (!isOffHours) {
    return null;
  }

  // Check if user commonly accesses at this hour
  if (userPattern) {
    const historicalOffHoursAccess = await countHistoricalOffHoursAccess(userId, orgId);
    // If user has significant off-hours history, reduce confidence
    if (historicalOffHoursAccess > 10) {
      return null;
    }
  }

  return {
    type: "OFF_HOURS_ACCESS",
    confidence: 0.7,
    details: {
      currentHour,
      businessHoursStart: businessHours.start,
      businessHoursEnd: businessHours.end,
    },
    severity: currentHour < 4 || currentHour >= 23 ? "high" : "medium",
    description: `Access at ${currentHour}:00 is outside normal business hours (${businessHours.start}:00 - ${businessHours.end}:00)`,
    timestamp: now,
  };
}

async function countHistoricalOffHoursAccess(userId: string, orgId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // This is a simplified check - in production, you'd want to properly
  // filter by hour in the database query
  const logs = await prisma.auditLog.findMany({
    where: {
      orgId,
      userId,
      timestamp: { gte: thirtyDaysAgo },
    },
    select: { timestamp: true },
    take: 1000,
  });

  return logs.filter((log) => {
    const hour = log.timestamp.getHours();
    return hour < DEFAULT_BUSINESS_HOURS.start || hour >= DEFAULT_BUSINESS_HOURS.end;
  }).length;
}

async function checkGeographicAnomaly(
  userId: string,
  ip: string,
  userPattern: UserAccessPattern | null
): Promise<AnomalyIndicator | null> {
  const country = await getCountryFromIP(ip);

  // Skip if we couldn't determine country
  if (!country || country === "LOCAL") {
    return null;
  }

  // Check if this is a known country for the user
  const knownCountries = userPattern?.knownCountries ?? [];

  if (knownCountries.length > 0 && !knownCountries.includes(country)) {
    const isHighRisk = HIGH_RISK_COUNTRIES.has(country);

    return {
      type: "GEOGRAPHIC_ANOMALY",
      confidence: isHighRisk ? 0.9 : 0.75,
      details: {
        detectedCountry: country,
        knownCountries,
        isHighRisk,
        ip: maskIP(ip),
      },
      severity: isHighRisk ? "critical" : "high",
      description: `Access from ${country} - user typically accesses from: ${knownCountries.join(", ")}`,
      timestamp: new Date(),
    };
  }

  return null;
}

async function checkUnusualAccessPattern(
  userId: string,
  orgId: string,
  action: string,
  userPattern: UserAccessPattern | null
): Promise<AnomalyIndicator | null> {
  if (!userPattern) {
    return null;
  }

  const now = new Date();

  // Check if current activity deviates significantly from baseline
  // For example, if user typically exports 5 items/day and today exported 25

  if (action === "EXPORT") {
    const todayExports = await countExportsToday(userId, orgId);
    const avgExports = userPattern.avgDailyExports;

    // Flag if more than 3x the average
    if (avgExports > 0 && todayExports > avgExports * 3) {
      return {
        type: "UNUSUAL_ACCESS_PATTERN",
        confidence: Math.min(0.9, (todayExports / avgExports - 1) / 5),
        details: {
          metric: "daily_exports",
          average: avgExports,
          current: todayExports,
          ratio: todayExports / avgExports,
        },
        severity: todayExports > avgExports * 5 ? "high" : "medium",
        description: `Export activity (${todayExports}) is ${(todayExports / avgExports).toFixed(1)}x higher than usual (avg: ${avgExports.toFixed(1)})`,
        timestamp: now,
      };
    }
  }

  if (action === "VIEW" || action === "CLIENT") {
    const todayViews = await countClientViewsLastHour(userId, orgId);
    const avgViews = userPattern.avgDailyClientViews / 24; // Rough hourly average

    if (avgViews > 0 && todayViews > avgViews * 5) {
      return {
        type: "UNUSUAL_ACCESS_PATTERN",
        confidence: Math.min(0.85, (todayViews / avgViews - 1) / 10),
        details: {
          metric: "hourly_client_views",
          average: avgViews,
          current: todayViews,
          ratio: todayViews / avgViews,
        },
        severity: todayViews > avgViews * 10 ? "high" : "medium",
        description: `Client view activity (${todayViews}/hr) is ${(todayViews / avgViews).toFixed(1)}x higher than usual`,
        timestamp: now,
      };
    }
  }

  return null;
}

async function checkRapidFireRequests(
  userId: string,
  orgId: string
): Promise<AnomalyIndicator | null> {
  const oneSecondAgo = new Date(Date.now() - 1000);

  // Count requests in the last second
  const recentRequests = await prisma.auditLog.count({
    where: {
      orgId,
      userId,
      timestamp: { gte: oneSecondAgo },
    },
  });

  // Flag if more than 10 requests per second (likely automated)
  if (recentRequests > 10) {
    return {
      type: "RAPID_FIRE_REQUESTS",
      confidence: Math.min(0.95, recentRequests / 20),
      details: {
        requestsPerSecond: recentRequests,
        threshold: 10,
      },
      severity: recentRequests > 50 ? "critical" : "high",
      description: `Detected ${recentRequests} requests/second - possible automated access`,
      timestamp: new Date(),
    };
  }

  return null;
}

// ============================================
// USER ACCESS PATTERN CALCULATION
// ============================================

/**
 * Get user's historical access pattern for anomaly comparison
 */
async function getUserAccessPattern(userId: string): Promise<UserAccessPattern | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, orgId: true },
  });

  if (!user) return null;

  // Get aggregated stats from audit logs
  const [exportCount, viewCount, accessLogs] = await Promise.all([
    prisma.auditLog.count({
      where: {
        userId,
        action: "EXPORT",
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        userId,
        action: "VIEW",
        resource: "CLIENT",
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        userId,
        timestamp: { gte: thirtyDaysAgo },
      },
      select: {
        timestamp: true,
        ipAddress: true,
      },
      take: 5000,
    }),
  ]);

  const daysActive = 30;

  // Analyze access hours
  const hourCounts = new Array(24).fill(0);
  const countries: Set<string> = new Set();

  for (const log of accessLogs) {
    hourCounts[log.timestamp.getHours()]++;

    if (log.ipAddress) {
      const country = await getCountryFromIP(log.ipAddress);
      if (country && country !== "LOCAL") {
        countries.add(country);
      }
    }
  }

  // Find typical access hours (where most activity occurs)
  const totalRequests = accessLogs.length;
  let typicalStart = 8;
  let typicalEnd = 18;

  if (totalRequests > 0) {
    // Find the range containing 80% of requests
    const threshold = totalRequests * 0.1; // 10% at each tail
    let cumulative = 0;

    for (let i = 0; i < 24; i++) {
      cumulative += hourCounts[i];
      if (cumulative >= threshold && typicalStart === 8) {
        typicalStart = i;
      }
      if (cumulative >= totalRequests - threshold) {
        typicalEnd = i + 1;
        break;
      }
    }
  }

  return {
    userId,
    avgDailyExports: exportCount / daysActive,
    avgDailyClientViews: viewCount / daysActive,
    typicalAccessHours: { start: typicalStart, end: typicalEnd },
    knownCountries: Array.from(countries),
    avgRequestsPerMinute: accessLogs.length / (daysActive * 24 * 60),
    lastCalculated: new Date(),
  };
}

// ============================================
// RISK SCORE CALCULATION
// ============================================

/**
 * Calculate a risk score (0-100) based on violations and anomalies
 */
export function calculateRiskScore(
  violations: ThresholdViolation[],
  anomalies: AnomalyIndicator[]
): number {
  let score = 0;

  // Add points for threshold violations
  for (const violation of violations) {
    const baseWeight = RISK_WEIGHTS.threshold[violation.type] || 15;
    const severityMultiplier = getSeverityMultiplier(violation.severity);
    const overageMultiplier = Math.min(2, violation.actual / violation.threshold);

    score += baseWeight * severityMultiplier * overageMultiplier;
  }

  // Add points for anomalies (weighted by confidence)
  for (const anomaly of anomalies) {
    const baseWeight = RISK_WEIGHTS.anomaly[anomaly.type] || 15;
    const severityMultiplier = getSeverityMultiplier(anomaly.severity);

    score += baseWeight * severityMultiplier * anomaly.confidence;
  }

  // Cap at 100
  return Math.min(100, Math.round(score));
}

function getSeverityMultiplier(severity: "low" | "medium" | "high" | "critical"): number {
  switch (severity) {
    case "critical":
      return 1.5;
    case "high":
      return 1.2;
    case "medium":
      return 1.0;
    case "low":
      return 0.7;
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 50) return "WARNING";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

// ============================================
// MAIN EVALUATION FUNCTION
// ============================================

/**
 * Evaluate overall security risk for a user action
 *
 * This is the main entry point for the breach detection system.
 * Call this on sensitive actions (PHI access, exports, bulk operations).
 */
export async function evaluateSecurityRisk(
  userId: string,
  orgId: string,
  action: string,
  ip: string
): Promise<SecurityRiskResult> {
  const timestamp = new Date();

  // Run threshold checks and anomaly detection in parallel
  const [violations, anomalies] = await Promise.all([
    checkThresholds(userId, orgId),
    detectAnomalies(userId, orgId, action, ip),
  ]);

  // Calculate risk score
  const riskScore = calculateRiskScore(violations, anomalies);
  const riskLevel = getRiskLevel(riskScore);
  const requiresAlert = riskScore >= 50;

  // Log the evaluation
  logger.security(
    riskScore >= 50 ? "suspicious_activity" : "auth_success",
    `Security risk evaluation: score=${riskScore}, level=${riskLevel}`,
    {
      userId,
      organizationId: orgId,
      action,
      riskScore,
      riskLevel,
      violationCount: violations.length,
      anomalyCount: anomalies.length,
    }
  );

  // Trigger alert if needed
  let alertTriggered = false;
  if (requiresAlert) {
    try {
      await triggerSecurityAlert({
        type: riskLevel === "CRITICAL" ? "CRITICAL" : "WARNING",
        userId,
        orgId,
        riskScore,
        violations,
        anomalies,
        action,
        ip: maskIP(ip),
        timestamp,
      });
      alertTriggered = true;
    } catch (error) {
      logger.error("Failed to trigger security alert", error, {
        userId,
        organizationId: orgId,
        riskScore,
      });
    }
  }

  return {
    userId,
    orgId,
    riskScore,
    riskLevel,
    violations,
    anomalies,
    timestamp,
    requiresAlert,
    alertTriggered,
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick check for sensitive operations
 * Returns true if the action should be blocked or require additional verification
 */
export async function shouldBlockAction(
  userId: string,
  orgId: string,
  action: string,
  ip: string
): Promise<{ blocked: boolean; reason?: string; riskScore: number }> {
  const result = await evaluateSecurityRisk(userId, orgId, action, ip);

  if (result.riskLevel === "CRITICAL") {
    return {
      blocked: true,
      reason: `Security risk too high (score: ${result.riskScore}). Please contact your administrator.`,
      riskScore: result.riskScore,
    };
  }

  return {
    blocked: false,
    riskScore: result.riskScore,
  };
}

/**
 * Check if user account should be locked due to failed logins
 */
export async function checkLoginLockout(
  userId: string
): Promise<{ locked: boolean; remainingAttempts: number; lockUntil?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  if (!user) {
    return { locked: false, remainingAttempts: 0 };
  }

  // Check if currently locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      locked: true,
      remainingAttempts: 0,
      lockUntil: user.lockedUntil,
    };
  }

  const maxAttempts = DEFAULT_THRESHOLDS.maxFailedLoginsPerHour;
  const remaining = Math.max(0, maxAttempts - user.failedLoginAttempts);

  return {
    locked: false,
    remainingAttempts: remaining,
  };
}

/**
 * Record a failed login attempt and check if account should be locked
 */
export async function recordFailedLogin(
  userId: string
): Promise<{ locked: boolean; lockUntil?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });

  if (!user) {
    return { locked: false };
  }

  const newAttempts = user.failedLoginAttempts + 1;
  const shouldLock = newAttempts >= DEFAULT_THRESHOLDS.maxFailedLoginsPerHour;

  // Lock for 30 minutes if threshold exceeded
  const lockUntil = shouldLock ? new Date(Date.now() + 30 * 60 * 1000) : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lockedUntil: lockUntil,
    },
  });

  if (shouldLock) {
    logger.security("auth_failure", `Account locked due to ${newAttempts} failed login attempts`, {
      userId,
      failedAttempts: newAttempts,
      lockUntil: lockUntil?.toISOString(),
    });
  }

  return {
    locked: shouldLock,
    lockUntil,
  };
}

/**
 * Clear failed login attempts after successful login
 */
export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}
