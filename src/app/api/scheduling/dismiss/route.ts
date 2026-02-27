/**
 * POST /api/scheduling/dismiss
 *
 * Dismiss a pending scheduling item.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PendingSchedulingStatus } from '@prisma/client'

// ============================================
// TYPES
// ============================================

interface DismissRequest {
  pendingItemId: string
}

// ============================================
// ROUTE HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Parse and validate request body
    const body = (await request.json()) as DismissRequest

    if (!body.pendingItemId) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'pendingItemId is required',
          },
        },
        { status: 400 }
      )
    }

    // Step 1: Fetch pending item and verify ownership
    const pendingItem = await prisma.pendingSchedulingItem.findUnique({
      where: { id: body.pendingItemId },
      select: {
        id: true,
        userId: true,
        status: true,
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
            message: 'You do not have permission to dismiss this item',
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

    // Step 2: Update pending item status
    await prisma.pendingSchedulingItem.update({
      where: { id: pendingItem.id },
      data: {
        status: PendingSchedulingStatus.DISMISSED,
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error dismissing scheduling item:', error)

    // Handle redirect from requireAuth
    if (error instanceof Response) {
      return error
    }

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to dismiss scheduling item',
        },
      },
      { status: 500 }
    )
  }
}
