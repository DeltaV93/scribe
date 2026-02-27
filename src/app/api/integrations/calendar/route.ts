/**
 * Calendar Integration API
 *
 * GET /api/integrations/calendar - Get current calendar integration status
 * DELETE /api/integrations/calendar - Disconnect calendar integration
 * PATCH /api/integrations/calendar - Update calendar settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getCalendarIntegration,
  disconnectCalendar,
  updateCalendarSettings,
  getAvailableProviders,
} from '@/lib/calendar/service'

/**
 * GET /api/integrations/calendar
 * Get current calendar integration status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const integration = await getCalendarIntegration(user.id)
    const availableProviders = getAvailableProviders()

    if (!integration || integration.status === 'DISCONNECTED') {
      return NextResponse.json({
        connected: false,
        availableProviders,
      })
    }

    return NextResponse.json({
      connected: integration.status === 'ACTIVE',
      provider: integration.provider,
      email: integration.externalEmail,
      status: integration.status,
      clientAutoInvite: integration.clientAutoInvite,
      connectedAt: integration.connectedAt?.toISOString(),
      lastSyncAt: integration.lastSyncAt?.toISOString(),
      error: integration.lastError,
      availableProviders,
    })
  } catch (error) {
    console.error('[Calendar API] GET error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get calendar status' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/calendar
 * Disconnect calendar integration
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const result = await disconnectCalendar(user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'DISCONNECT_FAILED', message: result.error } },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Calendar API] DELETE error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect calendar' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/integrations/calendar
 * Update calendar settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { clientAutoInvite } = body

    // Validate input
    if (typeof clientAutoInvite !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'clientAutoInvite must be a boolean' } },
        { status: 400 }
      )
    }

    const result = await updateCalendarSettings(user.id, {
      clientAutoInvite,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: result.error } },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Calendar API] PATCH error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update calendar settings' } },
      { status: 500 }
    )
  }
}
