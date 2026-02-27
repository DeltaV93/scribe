/**
 * GET /api/scheduling/pending
 *
 * List pending scheduling items for the current user.
 * Optionally filter by callId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PendingSchedulingStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')

    // Build query
    const where = {
      userId: user.id,
      status: PendingSchedulingStatus.PENDING,
      ...(callId && { callId }),
    }

    // Fetch pending items with client info
    const pendingItems = await prisma.pendingSchedulingItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        call: {
          select: {
            id: true,
            startedAt: true,
          },
        },
      },
    })

    // Transform response
    const items = pendingItems.map((item) => ({
      id: item.id,
      callId: item.callId,
      clientName: item.clientName,
      clientEmail: item.client?.email || null,
      extractedContext: item.extractedContext,
      extractedDateHint: item.extractedDateHint,
      hasRecurrence: item.hasRecurrence,
      recurrencePattern: item.recurrencePattern,
      tier: item.tier,
      conflictDetails: item.conflictDetails
        ? {
            conflictingEventTitle: (item.conflictDetails as Record<string, string>).conflictingEventTitle,
            conflictingEventTime: (item.conflictDetails as Record<string, string>).conflictingEventTime,
          }
        : null,
      createdAt: item.createdAt.toISOString(),
      callDate: item.call?.startedAt?.toISOString() || null,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[API] Error fetching pending scheduling items:', error)

    // Handle redirect from requireAuth
    if (error instanceof Response) {
      return error
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch pending scheduling items',
        },
      },
      { status: 500 }
    )
  }
}
