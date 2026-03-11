/**
 * Document Extraction API - Apply Extraction
 *
 * POST /api/document-extraction/[extractionId]/apply - Apply extracted data to form submission
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { applyExtractionToSubmission } from '@/lib/services/document-extraction'

interface RouteParams {
  params: Promise<{ extractionId: string }>
}

/**
 * POST /api/document-extraction/[extractionId]/apply
 * Apply extracted data to a form submission
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    if (jobProgress.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Cannot apply extraction with status: ${jobProgress.status}` },
        { status: 400 }
      )
    }

    // Parse options from request body
    const body = await request.json().catch(() => ({}))
    const options = {
      minConfidence: body.minConfidence,
      overwriteExisting: body.overwriteExisting,
      includeFieldIds: body.includeFieldIds,
      excludeFieldIds: body.excludeFieldIds,
    }

    const result = await applyExtractionToSubmission(extractionId, options)

    return NextResponse.json({
      success: true,
      submissionId: result.submissionId,
      appliedFields: result.appliedFields,
      skippedFields: result.skippedFields,
      details: result.details,
    })
  } catch (error) {
    console.error('Apply extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
