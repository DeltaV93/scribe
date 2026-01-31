/**
 * Document Extraction API
 *
 * POST /api/document-extraction - Upload file and start extraction
 * GET /api/document-extraction - List extractions for user/form
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import {
  startDocumentExtraction,
  processDocumentExtraction,
  listExtractions,
} from '@/lib/services/document-extraction'
import { addJob, createJobProgress } from '@/lib/jobs'

/**
 * POST /api/document-extraction
 * Upload a document and start extraction for a form
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const formId = formData.get('formId') as string | null
    const clientId = formData.get('clientId') as string | null
    const processAsync = formData.get('async') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!formId) {
      return NextResponse.json({ error: 'Form ID is required' }, { status: 400 })
    }

    // Verify form exists
    const form = await prisma.form.findFirst({
      where: { id: formId, orgId: dbUser.orgId },
      select: { id: true, name: true },
    })

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Start extraction
    const result = await startDocumentExtraction({
      orgId: dbUser.orgId,
      userId: dbUser.id,
      formId,
      clientId: clientId || undefined,
      filename: file.name,
      mimeType: file.type,
      buffer,
    })

    if (processAsync) {
      // Queue job for async processing
      await addJob('form-conversion', {
        jobProgressId: result.extractionId,
        conversionId: result.extractionId,
        sourcePath: '', // Will be populated from job metadata
        sourceType: file.type === 'application/pdf' ? 'PDF_CLEAN' : 'PHOTO',
        orgId: dbUser.orgId,
        userId: dbUser.id,
      })

      return NextResponse.json({
        success: true,
        extractionId: result.extractionId,
        status: 'PENDING',
        message: 'Extraction started. Poll for status.',
      })
    } else {
      // Process synchronously
      const extractionResult = await processDocumentExtraction(
        result.extractionId,
        buffer
      )

      return NextResponse.json({
        success: extractionResult.success,
        extractionId: result.extractionId,
        status: extractionResult.success ? 'COMPLETED' : 'FAILED',
        result: {
          pageCount: extractionResult.pageCount,
          isScanned: extractionResult.isScanned,
          fields: extractionResult.fields,
          overallConfidence: extractionResult.overallConfidence,
          warnings: extractionResult.warnings,
        },
        error: extractionResult.error,
      })
    }
  } catch (error) {
    console.error('Document extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/document-extraction
 * List extractions for the current user or a specific form
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const formId = searchParams.get('formId') || undefined
    const status = searchParams.get('status') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const myOnly = searchParams.get('myOnly') === 'true'

    const result = await listExtractions({
      orgId: dbUser.orgId,
      formId,
      userId: myOnly ? dbUser.id : undefined,
      status,
      limit,
      offset,
    })

    return NextResponse.json({
      items: result.items.map((item) => ({
        id: item.id,
        status: item.status,
        progress: item.progress,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        user: item.user,
        metadata: item.metadata,
        error: item.error,
      })),
      total: result.total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List extractions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
