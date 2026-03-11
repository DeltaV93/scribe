/**
 * Document Extraction API - Field Updates
 *
 * PATCH /api/document-extraction/[extractionId]/fields - Update extracted field values
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { updateExtractedField } from '@/lib/services/document-extraction'

interface RouteParams {
  params: Promise<{ extractionId: string }>
}

/**
 * PATCH /api/document-extraction/[extractionId]/fields
 * Update extracted field values (for manual corrections)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    // Parse updates from request body
    const body = await request.json()

    if (!body.fieldId) {
      return NextResponse.json({ error: 'Field ID is required' }, { status: 400 })
    }

    const result = await updateExtractedField(
      extractionId,
      body.fieldId,
      body.value,
      body.confidence
    )

    if (!result) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      field: result,
    })
  } catch (error) {
    console.error('Update field error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
