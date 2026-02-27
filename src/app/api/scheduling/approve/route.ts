/**
 * POST /api/scheduling/approve
 *
 * Approve a pending scheduling item and create the calendar event.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  PendingSchedulingStatus,
  CalendarIntegrationStatus,
  CalendarEventStatus,
} from '@prisma/client'
import { createCalendarAdapter } from '@/lib/calendar/adapters'
import { getCalendarAccessToken } from '@/lib/calendar/service'
import { createAuditLog } from '@/lib/audit/service'
import type { CalendarEventInput, RecurrenceRule } from '@/lib/calendar/types'
import { toRRule } from '@/lib/calendar/types'

// ============================================
// TYPES
// ============================================

interface ApproveRequest {
  pendingItemId: string
  startTime: string // ISO datetime
  endTime?: string // defaults to startTime + 30 min
  recurrence?: {
    frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
    daysOfWeek?: number[] // 0=Sun, 6=Sat
    until?: string // ISO date
  }
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_DURATION_MINUTES = 30
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.scrybe.io'

// ============================================
// ROUTE HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Parse and validate request body
    const body = (await request.json()) as ApproveRequest

    if (!body.pendingItemId || !body.startTime) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'pendingItemId and startTime are required',
          },
        },
        { status: 400 }
      )
    }

    // Validate startTime is valid ISO datetime
    const startTime = new Date(body.startTime)
    if (isNaN(startTime.getTime())) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid startTime format. Use ISO 8601 datetime.',
          },
        },
        { status: 400 }
      )
    }

    // Calculate endTime (default to 30 min after start)
    const endTime = body.endTime
      ? new Date(body.endTime)
      : new Date(startTime.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000)

    if (isNaN(endTime.getTime())) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid endTime format. Use ISO 8601 datetime.',
          },
        },
        { status: 400 }
      )
    }

    // Step 1: Fetch pending item and verify ownership
    const pendingItem = await prisma.pendingSchedulingItem.findUnique({
      where: { id: body.pendingItemId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!pendingItem) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Pending scheduling item not found',
          },
        },
        { status: 404 }
      )
    }

    if (pendingItem.userId !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to approve this item',
          },
        },
        { status: 403 }
      )
    }

    if (pendingItem.status !== PendingSchedulingStatus.PENDING) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATE',
            message: `Item has already been ${pendingItem.status.toLowerCase()}`,
          },
        },
        { status: 400 }
      )
    }

    // Step 2: Get calendar integration
    const integration = await prisma.calendarIntegration.findUnique({
      where: { userId: user.id },
    })

    if (!integration || integration.status !== CalendarIntegrationStatus.ACTIVE) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_CALENDAR',
            message: 'No active calendar integration. Please connect a calendar in Settings.',
          },
        },
        { status: 400 }
      )
    }

    // Step 3: Get access token
    const accessToken = await getCalendarAccessToken(user.id)
    if (!accessToken) {
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_ERROR',
            message: 'Failed to retrieve calendar access token. Please reconnect your calendar.',
          },
        },
        { status: 401 }
      )
    }

    // Step 4: Create adapter and check for conflicts
    const adapter = createCalendarAdapter(integration.provider)
    const conflictResult = await adapter.checkConflicts(accessToken, startTime, endTime)

    if (conflictResult.hasConflict && conflictResult.conflicts.length > 0) {
      const conflict = conflictResult.conflicts[0]
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'The selected time slot has a conflict',
            conflict: {
              title: conflict.title,
              startTime: conflict.startTime.toISOString(),
              endTime: conflict.endTime.toISOString(),
            },
          },
        },
        { status: 409 }
      )
    }

    // Step 5: Build recurrence rule if provided
    let recurrence: RecurrenceRule | undefined
    if (body.recurrence) {
      recurrence = {
        frequency: body.recurrence.frequency,
        daysOfWeek: body.recurrence.daysOfWeek,
        until: body.recurrence.until ? new Date(body.recurrence.until) : undefined,
      }
    }

    // Step 6: Build event input
    const eventInput: CalendarEventInput = {
      title: `Scrybe: Follow-up with ${pendingItem.clientName}`,
      description: `View interaction: ${APP_URL}/calls/${pendingItem.callId}`,
      startTime,
      endTime,
      attendees:
        integration.clientAutoInvite && pendingItem.client?.email
          ? [
              {
                email: pendingItem.client.email,
                name: `${pendingItem.client.firstName} ${pendingItem.client.lastName}`.trim(),
              },
            ]
          : [],
      recurrence,
    }

    // Step 7: Create calendar event
    let createResult
    if (recurrence) {
      createResult = await adapter.createRecurringEvent(accessToken, eventInput, recurrence)
    } else {
      createResult = await adapter.createEvent(accessToken, eventInput)
    }

    if (!createResult.success || !createResult.eventId) {
      return NextResponse.json(
        {
          error: {
            code: 'CALENDAR_ERROR',
            message: createResult.error || 'Failed to create calendar event',
          },
        },
        { status: 500 }
      )
    }

    // Step 8: Create CalendarEvent record and update PendingSchedulingItem
    const [calendarEvent] = await prisma.$transaction([
      prisma.calendarEvent.create({
        data: {
          userId: user.id,
          orgId: pendingItem.orgId,
          callId: pendingItem.callId,
          clientId: pendingItem.clientId,
          pendingSchedulingItemId: pendingItem.id,
          externalEventId: createResult.eventId,
          provider: integration.provider,
          title: eventInput.title,
          startTime,
          endTime,
          isRecurring: !!recurrence,
          rrule: recurrence ? toRRule(recurrence) : null,
          clientInvited: eventInput.attendees && eventInput.attendees.length > 0,
          status: CalendarEventStatus.CREATED,
          calendarIntegrationId: integration.id,
        },
      }),
      prisma.pendingSchedulingItem.update({
        where: { id: pendingItem.id },
        data: {
          status: PendingSchedulingStatus.APPROVED,
          resolvedAt: new Date(),
        },
      }),
    ])

    // Step 9: Create audit log
    await createAuditLog({
      orgId: pendingItem.orgId,
      userId: user.id,
      action: 'CREATE',
      resource: 'CALENDAR_EVENT',
      resourceId: calendarEvent.id,
      resourceName: eventInput.title,
      details: {
        type: 'CALENDAR_EVENT_CREATED',
        callId: pendingItem.callId,
        clientId: pendingItem.clientId,
        externalEventId: createResult.eventId,
        provider: integration.provider,
        isRecurring: !!recurrence,
        tier: 'TIER_2_APPROVED',
        pendingItemId: pendingItem.id,
      },
    })

    return NextResponse.json({
      success: true,
      eventId: createResult.eventId,
      calendarEventId: calendarEvent.id,
    })
  } catch (error) {
    console.error('[API] Error approving scheduling item:', error)

    // Handle redirect from requireAuth
    if (error instanceof Response) {
      return error
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to approve scheduling item',
        },
      },
      { status: 500 }
    )
  }
}
