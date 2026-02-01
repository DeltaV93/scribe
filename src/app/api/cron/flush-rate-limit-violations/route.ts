/**
 * Cron Job: Flush Rate Limit Violations to Audit Log
 *
 * This endpoint should be called periodically (e.g., every minute)
 * to persist rate limit violations to the audit system.
 *
 * Protected by CRON_SECRET for security.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { flushViolationsToAudit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[RateLimit Cron] CRON_SECRET not configured')
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Create an adapter function that matches the expected signature
    const logViolation = async (input: {
      orgId: string
      userId?: string | null
      action: string
      resource: string
      resourceId: string
      details?: Record<string, unknown>
      ipAddress?: string
      userAgent?: string
    }) => {
      // Map to the actual audit log format
      // Note: Rate limit violations use SECURITY as resource type
      // We need to add these types to the audit system if not present
      return createAuditLog({
        orgId: input.orgId,
        userId: input.userId,
        // Cast to expected types - in production, you'd want to add these
        // to the AuditAction and AuditResource types
        action: 'CREATE' as const, // Using CREATE as a placeholder
        resource: 'SETTING' as const, // Using SETTING as a placeholder for SECURITY
        resourceId: input.resourceId,
        resourceName: 'Rate Limit Violation',
        details: {
          ...input.details,
          type: 'RATE_LIMIT_VIOLATION',
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
    }

    const count = await flushViolationsToAudit(logViolation)

    return NextResponse.json({
      success: true,
      violationsLogged: count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[RateLimit Cron] Error flushing violations:', error)
    return NextResponse.json(
      {
        error: 'Failed to flush violations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Allow both GET and POST for flexibility
  return GET(request)
}
