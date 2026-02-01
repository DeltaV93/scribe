/**
 * Rate Limit Audit Integration
 *
 * Provides integration with the audit logging system
 * to record rate limit violations for SOC 2 compliance.
 */

import { getAndClearViolations, type RateLimitViolation } from './middleware'

/**
 * Severity level for rate limit violations
 */
export type ViolationSeverity = 'low' | 'medium' | 'high'

/**
 * Determine severity based on violation patterns
 */
export function getViolationSeverity(
  violation: RateLimitViolation
): ViolationSeverity {
  // Authentication violations are high severity (potential brute force)
  if (violation.category === 'authentication') {
    return 'high'
  }

  // File upload violations could indicate abuse
  if (violation.category === 'file_upload') {
    return 'medium'
  }

  // API violations with very low remaining are concerning
  if (violation.retryAfter > 300) {
    // More than 5 minutes wait
    return 'medium'
  }

  return 'low'
}

/**
 * Format a violation for audit logging
 */
export function formatViolationForAudit(violation: RateLimitViolation): {
  action: string
  resource: string
  resourceId: string
  details: Record<string, unknown>
  severity: ViolationSeverity
} {
  const severity = getViolationSeverity(violation)

  return {
    action: 'RATE_LIMIT_EXCEEDED',
    resource: 'SECURITY',
    resourceId: `rate_limit:${violation.category}`,
    details: {
      category: violation.category,
      path: violation.path,
      method: violation.method,
      ipAddress: violation.ip,
      userAgent: violation.userAgent,
      limit: violation.limit,
      retryAfter: violation.retryAfter,
      severity,
    },
    severity,
  }
}

/**
 * Log rate limit violations to the audit system
 *
 * This should be called periodically (e.g., every minute)
 * to flush accumulated violations to the audit log.
 *
 * Note: This function doesn't directly import the audit service
 * to avoid circular dependencies. The caller should handle
 * the actual audit log creation.
 */
export async function flushViolationsToAudit(
  createAuditLog: (input: {
    orgId: string
    userId?: string | null
    action: string
    resource: string
    resourceId: string
    details?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }) => Promise<unknown>
): Promise<number> {
  const violations = getAndClearViolations()

  if (violations.length === 0) {
    return 0
  }

  // Group violations by IP to reduce noise
  const groupedByIp = new Map<string, RateLimitViolation[]>()
  for (const violation of violations) {
    const key = violation.ip || 'unknown'
    const existing = groupedByIp.get(key) || []
    existing.push(violation)
    groupedByIp.set(key, existing)
  }

  let logged = 0

  const groupedEntries = Array.from(groupedByIp.entries())
  for (let i = 0; i < groupedEntries.length; i++) {
    const [, ipViolations] = groupedEntries[i]
    // Log the most severe violation per IP, with count
    const sortedBySeverity = ipViolations.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return (
        severityOrder[getViolationSeverity(a)] -
        severityOrder[getViolationSeverity(b)]
      )
    })

    const mostSevere = sortedBySeverity[0]
    const formatted = formatViolationForAudit(mostSevere)

    try {
      await createAuditLog({
        // Use a system org ID for violations without user context
        // In a real implementation, you might want to resolve the org
        // based on the user ID if available
        orgId: 'SYSTEM',
        userId: mostSevere.userId,
        action: formatted.action,
        resource: formatted.resource,
        resourceId: formatted.resourceId,
        details: {
          ...formatted.details,
          violationCount: ipViolations.length,
          categories: Array.from(new Set(ipViolations.map((v) => v.category))),
        },
        ipAddress: mostSevere.ip || undefined,
        userAgent: mostSevere.userAgent || undefined,
      })
      logged++
    } catch (error) {
      console.error('[RateLimit] Failed to log violation to audit:', error)
    }
  }

  return logged
}

/**
 * Get a summary of current violation statistics
 *
 * Useful for monitoring dashboards
 */
export function getViolationSummary(): {
  total: number
  byCategory: Record<string, number>
  bySeverity: Record<ViolationSeverity, number>
  topOffenders: { ip: string; count: number }[]
} {
  const violations = getAndClearViolations()

  if (violations.length === 0) {
    return {
      total: 0,
      byCategory: {},
      bySeverity: { low: 0, medium: 0, high: 0 },
      topOffenders: [],
    }
  }

  const byCategory: Record<string, number> = {}
  const bySeverity: Record<ViolationSeverity, number> = { low: 0, medium: 0, high: 0 }
  const byIp: Record<string, number> = {}

  for (const violation of violations) {
    // Count by category
    byCategory[violation.category] = (byCategory[violation.category] || 0) + 1

    // Count by severity
    const severity = getViolationSeverity(violation)
    bySeverity[severity]++

    // Count by IP
    if (violation.ip) {
      byIp[violation.ip] = (byIp[violation.ip] || 0) + 1
    }
  }

  // Get top 10 offending IPs
  const topOffenders = Object.entries(byIp)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total: violations.length,
    byCategory,
    bySeverity,
    topOffenders,
  }
}
