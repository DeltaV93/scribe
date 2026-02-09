/**
 * Security Alert Service
 *
 * Handles triggering and routing security alerts when potential breaches
 * or suspicious activity is detected.
 *
 * Alert Channels:
 * - Email to organization admins
 * - Email to Scrybe operations team
 * - In-app notifications
 * - Structured logging for SIEM integration
 *
 * Alert Types:
 * - CRITICAL (80+ risk score): Immediate attention required
 * - WARNING (50-79 risk score): Review recommended
 * - INFO (<50 risk score): Logged only
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { createNotification } from "@/lib/services/notifications";
import type { ThresholdViolation, AnomalyIndicator } from "./breach-detection";

// ============================================
// TYPES
// ============================================

export type AlertType = "CRITICAL" | "WARNING" | "INFO";

export interface SecurityAlert {
  type: AlertType;
  userId: string;
  orgId: string;
  riskScore: number;
  violations: ThresholdViolation[];
  anomalies: AnomalyIndicator[];
  action: string;
  ip: string;
  timestamp: Date;
}

export interface AlertRecipient {
  id: string;
  email: string;
  name: string | null;
}

export interface AlertResult {
  alertId: string;
  delivered: {
    orgAdmins: string[];
    scrypeOps: boolean;
    inAppNotifications: string[];
  };
  errors: string[];
}

// ============================================
// CONFIGURATION
// ============================================

// Scrybe operations email (placeholder for now)
const SCRYBE_OPS_EMAIL = process.env.SCRYBE_OPS_EMAIL || "security@scrybe.app";

// Alert cooldown to prevent spam (in milliseconds)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Track recent alerts to prevent duplicates
const recentAlerts = new Map<string, Date>();

// ============================================
// MAIN ALERT FUNCTION
// ============================================

/**
 * Trigger a security alert
 *
 * This function:
 * 1. Sends email notifications to org admins and Scrybe ops
 * 2. Creates in-app notifications for org admins
 * 3. Logs the alert for compliance and SIEM integration
 */
export async function triggerSecurityAlert(alert: SecurityAlert): Promise<AlertResult> {
  const alertId = generateAlertId(alert);
  const errors: string[] = [];
  const delivered = {
    orgAdmins: [] as string[],
    scrypeOps: false,
    inAppNotifications: [] as string[],
  };

  // Check cooldown to prevent alert spam
  const cooldownKey = `${alert.userId}:${alert.type}`;
  const lastAlert = recentAlerts.get(cooldownKey);

  if (lastAlert && Date.now() - lastAlert.getTime() < ALERT_COOLDOWN_MS) {
    logger.debug("Skipping alert due to cooldown", {
      alertId,
      userId: alert.userId,
      lastAlertAt: lastAlert.toISOString(),
    });
    return { alertId, delivered, errors: ["Alert skipped due to cooldown period"] };
  }

  // Update cooldown tracker
  recentAlerts.set(cooldownKey, new Date());
  cleanupOldCooldowns();

  try {
    // Get organization admins
    const orgAdmins = await getOrganizationAdmins(alert.orgId);

    // Get the user who triggered the alert (for context)
    const triggeringUser = await prisma.user.findUnique({
      where: { id: alert.userId },
      select: { email: true, name: true },
    });

    // Get organization name
    const org = await prisma.organization.findUnique({
      where: { id: alert.orgId },
      select: { name: true },
    });

    // Format the alert content
    const alertContent = formatAlertContent(alert, triggeringUser, org?.name ?? null);

    // Send email to org admins
    for (const admin of orgAdmins) {
      try {
        await sendSecurityAlertEmail(
          admin.email,
          alert.type,
          alertContent,
          admin.name
        );
        delivered.orgAdmins.push(admin.email);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to email ${admin.email}: ${errorMsg}`);
        logger.error("Failed to send security alert email to admin", error, {
          alertId,
          adminEmail: admin.email,
        });
      }
    }

    // Send email to Scrybe ops for critical alerts
    if (alert.type === "CRITICAL") {
      try {
        await sendSecurityAlertEmail(
          SCRYBE_OPS_EMAIL,
          alert.type,
          alertContent,
          "Scrybe Security Team",
          true // Mark as ops alert
        );
        delivered.scrypeOps = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to email Scrybe ops: ${errorMsg}`);
        logger.error("Failed to send security alert email to Scrybe ops", error, {
          alertId,
        });
      }
    }

    // Create in-app notifications for org admins
    for (const admin of orgAdmins) {
      try {
        await createNotification({
          userId: admin.id,
          type: "warning",
          title: `Security Alert: ${alert.type}`,
          message: `Suspicious activity detected. Risk score: ${alert.riskScore}. ${alert.violations.length} threshold violations and ${alert.anomalies.length} anomalies detected.`,
          metadata: {
            alertId,
            alertType: alert.type,
            riskScore: alert.riskScore,
            userId: alert.userId,
            action: alert.action,
          },
        });
        delivered.inAppNotifications.push(admin.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Failed to create notification for ${admin.id}: ${errorMsg}`);
      }
    }

    // Log the alert for compliance and SIEM
    await logSecurityAlert(alertId, alert, delivered, errors);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    errors.push(`Alert processing failed: ${errorMsg}`);
    logger.error("Security alert processing failed", error, { alertId });
  }

  return { alertId, delivered, errors };
}

// ============================================
// EMAIL SENDING (PLACEHOLDER)
// ============================================

/**
 * Send a security alert email
 *
 * NOTE: This is a placeholder implementation. In production, integrate with
 * your email service (AWS SES, SendGrid, etc.) using the existing email service.
 */
async function sendSecurityAlertEmail(
  to: string,
  alertType: AlertType,
  content: FormattedAlertContent,
  recipientName: string | null,
  isOpsAlert: boolean = false
): Promise<void> {
  // Format the email body
  const subject = `[${alertType}] Security Alert${isOpsAlert ? " (Ops)" : ""}: ${content.summary}`;

  const body = `
Security Alert - ${alertType}
${"=".repeat(50)}

${recipientName ? `Dear ${recipientName},` : "Dear Administrator,"}

A security alert has been triggered in ${content.orgName || "your organization"}.

Summary: ${content.summary}
Risk Score: ${content.riskScore}/100
Timestamp: ${content.timestamp}

User Involved:
- Name: ${content.userName || "Unknown"}
- Email: ${content.userEmail || "Unknown"}
- Action: ${content.action}
- IP Address: ${content.ip}

${content.violations.length > 0 ? `
Threshold Violations (${content.violations.length}):
${content.violations.map((v, i) => `  ${i + 1}. ${v}`).join("\n")}
` : ""}

${content.anomalies.length > 0 ? `
Anomalies Detected (${content.anomalies.length}):
${content.anomalies.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}
` : ""}

Recommended Actions:
${getRecommendedActions(alertType)}

Please investigate this activity and take appropriate action if necessary.

---
This is an automated security alert from Scrybe.
If you believe this alert is a false positive, please document your findings.
  `.trim();

  // In production, replace with actual email sending
  // For now, log to console as a placeholder
  console.log(`
[SECURITY ALERT EMAIL - PLACEHOLDER]
To: ${to}
Subject: ${subject}
---
${body}
---
NOTE: In production, this would be sent via AWS SES or another email provider.
  `);

  // Log that we "sent" the email
  logger.info("Security alert email queued", {
    to,
    alertType,
    isOpsAlert,
    riskScore: content.riskScore,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateAlertId(alert: SecurityAlert): string {
  const timestamp = alert.timestamp.getTime().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `alert_${timestamp}_${random}`;
}

async function getOrganizationAdmins(orgId: string): Promise<AlertRecipient[]> {
  const admins = await prisma.user.findMany({
    where: {
      orgId,
      role: "ADMIN",
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  return admins;
}

interface FormattedAlertContent {
  summary: string;
  riskScore: number;
  timestamp: string;
  userName: string | null;
  userEmail: string | null;
  orgName: string | null;
  action: string;
  ip: string;
  violations: string[];
  anomalies: string[];
}

function formatAlertContent(
  alert: SecurityAlert,
  user: { email: string; name: string | null } | null,
  orgName: string | null
): FormattedAlertContent {
  // Create summary based on alert type
  let summary: string;
  if (alert.type === "CRITICAL") {
    summary = `Critical security risk detected (score: ${alert.riskScore})`;
  } else if (alert.type === "WARNING") {
    summary = `Suspicious activity detected (score: ${alert.riskScore})`;
  } else {
    summary = `Security event logged (score: ${alert.riskScore})`;
  }

  // Format violations
  const violations = alert.violations.map(
    (v) => `[${v.severity.toUpperCase()}] ${v.description}`
  );

  // Format anomalies
  const anomalies = alert.anomalies.map(
    (a) => `[${a.severity.toUpperCase()}] ${a.description} (confidence: ${(a.confidence * 100).toFixed(0)}%)`
  );

  return {
    summary,
    riskScore: alert.riskScore,
    timestamp: alert.timestamp.toISOString(),
    userName: user?.name || null,
    userEmail: user?.email || null,
    orgName,
    action: alert.action,
    ip: alert.ip,
    violations,
    anomalies,
  };
}

function getRecommendedActions(alertType: AlertType): string {
  switch (alertType) {
    case "CRITICAL":
      return `
  1. Immediately review the user's recent activity in the audit logs
  2. Consider temporarily disabling the user account
  3. Contact the user to verify their identity
  4. Check for any data that may have been accessed or exported
  5. Document your investigation and findings`;

    case "WARNING":
      return `
  1. Review the user's recent activity in the audit logs
  2. Contact the user if the activity seems unusual
  3. Monitor for continued suspicious activity
  4. Document any concerns`;

    default:
      return `
  1. Note the activity for future reference
  2. No immediate action required`;
  }
}

async function logSecurityAlert(
  alertId: string,
  alert: SecurityAlert,
  delivered: AlertResult["delivered"],
  errors: string[]
): Promise<void> {
  // Log to structured logger for SIEM integration
  logger.security("suspicious_activity", `Security alert triggered: ${alertId}`, {
    alertId,
    alertType: alert.type,
    userId: alert.userId,
    organizationId: alert.orgId,
    riskScore: alert.riskScore,
    action: alert.action,
    ip: alert.ip,
    violationCount: alert.violations.length,
    anomalyCount: alert.anomalies.length,
    violations: alert.violations.map((v) => ({
      type: v.type,
      severity: v.severity,
      threshold: v.threshold,
      actual: v.actual,
    })),
    anomalies: alert.anomalies.map((a) => ({
      type: a.type,
      severity: a.severity,
      confidence: a.confidence,
    })),
    delivered: {
      orgAdminCount: delivered.orgAdmins.length,
      scrypeOps: delivered.scrypeOps,
      notificationCount: delivered.inAppNotifications.length,
    },
    errorCount: errors.length,
  });

  // Also create an audit log entry for compliance
  try {
    // Import dynamically to avoid circular dependency
    const { createAuditLog } = await import("@/lib/audit/service");

    await createAuditLog({
      orgId: alert.orgId,
      userId: alert.userId,
      action: "CREATE",
      resource: "SETTING", // Using SETTING as closest match for security events
      resourceId: alertId,
      resourceName: `Security Alert: ${alert.type}`,
      details: {
        alertType: alert.type,
        riskScore: alert.riskScore,
        violationCount: alert.violations.length,
        anomalyCount: alert.anomalies.length,
        alertDelivered: delivered.orgAdmins.length > 0 || delivered.scrypeOps,
      },
    });
  } catch (error) {
    logger.error("Failed to create audit log for security alert", error, {
      alertId,
    });
  }
}

function cleanupOldCooldowns(): void {
  const now = Date.now();
  for (const [key, timestamp] of recentAlerts.entries()) {
    if (now - timestamp.getTime() > ALERT_COOLDOWN_MS * 2) {
      recentAlerts.delete(key);
    }
  }
}

// ============================================
// ADDITIONAL ALERT FUNCTIONS
// ============================================

/**
 * Send an immediate critical alert (bypasses cooldown)
 * Use for emergency situations like confirmed breaches
 */
export async function sendEmergencyAlert(
  orgId: string,
  title: string,
  description: string,
  affectedUsers?: string[],
  additionalRecipients?: string[]
): Promise<void> {
  const alertId = `emergency_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  // Get org admins
  const orgAdmins = await getOrganizationAdmins(orgId);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const body = `
EMERGENCY SECURITY ALERT
${"=".repeat(50)}

Organization: ${org?.name || orgId}
Alert ID: ${alertId}
Time: ${new Date().toISOString()}

${title}

${description}

${affectedUsers && affectedUsers.length > 0 ? `
Affected Users: ${affectedUsers.length}
${affectedUsers.slice(0, 10).join(", ")}${affectedUsers.length > 10 ? ` (and ${affectedUsers.length - 10} more)` : ""}
` : ""}

IMMEDIATE ACTION REQUIRED:
1. Investigate the incident immediately
2. Contain any potential data exposure
3. Document all findings
4. Consider notifying affected parties per HIPAA requirements

---
This is an automated emergency alert from Scrybe Security.
  `.trim();

  // Send to all recipients
  const recipients = [
    ...orgAdmins.map((a) => a.email),
    SCRYBE_OPS_EMAIL,
    ...(additionalRecipients || []),
  ];

  for (const email of recipients) {
    console.log(`
[EMERGENCY SECURITY ALERT - PLACEHOLDER]
To: ${email}
Subject: [EMERGENCY] ${title}
---
${body}
---
    `);
  }

  // Create notifications for admins
  for (const admin of orgAdmins) {
    await createNotification({
      userId: admin.id,
      type: "warning",
      title: `EMERGENCY: ${title}`,
      message: description.substring(0, 500),
      metadata: { alertId, emergency: true },
    });
  }

  logger.security("suspicious_activity", `Emergency security alert: ${alertId}`, {
    alertId,
    organizationId: orgId,
    title,
    affectedUserCount: affectedUsers?.length || 0,
    recipientCount: recipients.length,
  });
}

/**
 * Report a security incident for investigation
 * Creates a record and notifies the security team
 */
export async function reportSecurityIncident(
  orgId: string,
  reporterId: string,
  incidentType: string,
  description: string,
  evidence?: Record<string, unknown>
): Promise<{ incidentId: string }> {
  const incidentId = `incident_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  // Get reporter info
  const reporter = await prisma.user.findUnique({
    where: { id: reporterId },
    select: { email: true, name: true },
  });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Log the incident
  logger.security("suspicious_activity", `Security incident reported: ${incidentId}`, {
    incidentId,
    incidentType,
    organizationId: orgId,
    reporterId,
    reporterEmail: reporter?.email,
    hasEvidence: !!evidence,
  });

  // Create audit log
  const { createAuditLog } = await import("@/lib/audit/service");
  await createAuditLog({
    orgId,
    userId: reporterId,
    action: "CREATE",
    resource: "SETTING",
    resourceId: incidentId,
    resourceName: `Security Incident: ${incidentType}`,
    details: {
      incidentType,
      description: description.substring(0, 1000),
      hasEvidence: !!evidence,
    },
  });

  // Notify Scrybe ops
  console.log(`
[SECURITY INCIDENT REPORT - PLACEHOLDER]
To: ${SCRYBE_OPS_EMAIL}
Subject: Security Incident Report: ${incidentType}
---
Incident ID: ${incidentId}
Organization: ${org?.name || orgId}
Reported By: ${reporter?.name || reporter?.email || reporterId}
Type: ${incidentType}
Time: ${new Date().toISOString()}

Description:
${description}

${evidence ? `Evidence Attached: Yes` : "Evidence Attached: No"}

Please investigate this incident.
---
  `);

  return { incidentId };
}
