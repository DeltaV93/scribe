/**
 * Document Extraction API - Single Extraction
 *
 * GET /api/document-extraction/[extractionId] - Get extraction status and results
 * DELETE /api/document-extraction/[extractionId] - Delete extraction
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import {
  getExtractionStatus,
  deleteExtraction,
} from '@/lib/services/document-extraction'

interface RouteParams {
  params: Promise<{ extractionId: string }>
}

/**
 * GET /api/document-extraction/[extractionId]
 * Get extraction status and results
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { extractionId } = await params

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify extraction belongs to user's org
    const jobProgress = await prisma.jobProgress.findFirst({
      where: {
        id: extractionId,
        orgId: dbUser.orgId,
        type: 'document-extraction',
      },
    })

    if (!jobProgress) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    const status = await getExtractionStatus(extractionId)

    if (!status) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: extractionId,
      status: status.status,
      progress: status.progress,
      result: status.result,
      error: status.error,
    })
  } catch (error) {
    console.error('Get extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/document-extraction/[extractionId]
 * Delete an extraction
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { extractionId } = await params

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify extraction belongs to user's org
    const jobProgress = await prisma.jobProgress.findFirst({
      where: {
        id: extractionId,
        orgId: dbUser.orgId,
        type: 'document-extraction',
      },
    })

    if (!jobProgress) {
      return NextResponse.json({ error: 'Extraction not found' }, { status: 404 })
    }

    await deleteExtraction(extractionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
