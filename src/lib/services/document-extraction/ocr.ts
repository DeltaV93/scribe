/**
 * Document Extraction OCR Service
 *
 * Provides OCR capabilities for extracting text from photos and PDFs.
 * Uses Claude Vision API for images and pdf-parse for native PDFs.
 */

import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'

// Lazy-load Anthropic client
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

/**
 * OCR result structure
 */
export interface OcrResult {
  text: string
  pageCount: number
  isScanned: boolean
  confidence: number
}

/**
 * Determine if a PDF is scanned (image-based) vs native text
 */
function isPdfScanned(text: string, pageCount: number): boolean {
  if (!text || text.trim().length === 0) {
    return true
  }

  // Calculate average characters per page
  const charsPerPage = text.length / Math.max(pageCount, 1)

  // If very few characters per page, likely scanned
  if (charsPerPage < 100) {
    return true
  }

  // Check for OCR artifacts (common in poorly scanned docs)
  const ocrArtifacts = /[^\x00-\x7F]{5,}|[\x00-\x08\x0B\x0C\x0E-\x1F]/g
  const artifactMatches = text.match(ocrArtifacts)

  if (artifactMatches && artifactMatches.length > 10) {
    return true
  }

  return false
}

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
  // First, try native text extraction
  const pdfData = await pdfParse(buffer)
  const nativeText = pdfData.text || ''
  const pageCount = pdfData.numpages || 1

  // Determine if PDF is scanned
  const isScanned = isPdfScanned(nativeText, pageCount)

  if (isScanned) {
    // For scanned PDFs, use Vision API
    return await extractWithVision(buffer, 'application/pdf', pageCount)
  }

  // Clean up the native text
  const cleanedText = nativeText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text: cleanedText,
    pageCount,
    isScanned: false,
    confidence: 0.95, // High confidence for native text
  }
}

/**
 * Extract text from an image buffer
 */
export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  return await extractWithVision(buffer, mimeType, 1)
}

/**
 * Use Claude Vision to extract text from document
 */
async function extractWithVision(
  buffer: Buffer,
  mimeType: string,
  pageCount: number
): Promise<OcrResult> {
  const client = getAnthropicClient()

  // Convert buffer to base64
  const base64Data = buffer.toString('base64')

  // Map MIME type for Claude
  const mediaType = mapMimeType(mimeType)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Extract ALL text content from this document image. This appears to be a filled-out form or document.

Instructions:
1. Extract every piece of text you can see, including:
   - Field labels and their corresponding values
   - Handwritten entries
   - Printed text
   - Checkmarks or X marks (indicate as [CHECKED] or [UNCHECKED])
   - Dates, numbers, names
   - Any signatures (indicate as [SIGNATURE PRESENT] or [NO SIGNATURE])

2. Preserve the structure and layout as much as possible
3. If text is unclear, indicate with [UNCLEAR: best guess]
4. For checkboxes/radio buttons, show the selection status

5. Format output as plain text, maintaining the general document structure.

Output ONLY the extracted text, nothing else.`,
          },
        ],
      },
    ],
  })

  // Extract text content
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Vision')
  }

  const extractedText = content.text.trim()

  // Estimate confidence based on text quality
  const confidence = estimateConfidence(extractedText)

  return {
    text: extractedText,
    pageCount,
    isScanned: true,
    confidence,
  }
}

/**
 * Estimate confidence based on extracted text quality
 */
function estimateConfidence(text: string): number {
  let confidence = 0.8 // Base confidence for OCR

  // Check for unclear markers
  const unclearCount = (text.match(/\[UNCLEAR/g) || []).length
  confidence -= unclearCount * 0.05

  // Check for reasonable text length
  if (text.length < 50) {
    confidence -= 0.2
  } else if (text.length > 500) {
    confidence += 0.05
  }

  // Check for common form patterns
  if (/name:|date:|address:|phone:|email:/i.test(text)) {
    confidence += 0.05
  }

  return Math.max(0.3, Math.min(0.95, confidence))
}

/**
 * Map MIME type for Claude API
 */
function mapMimeType(
  mimeType: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const map: Record<
    string,
    'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  > = {
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
    'application/pdf': 'image/png', // PDFs are converted to PNG for Vision
    'image/heic': 'image/jpeg', // HEIC converted to JPEG
    'image/heif': 'image/jpeg',
  }
  return map[mimeType] || 'image/jpeg'
}

/**
 * Validate magic bytes for file type
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false

  const magicBytes: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xdb],
    ],
    'image/png': [[0x89, 0x50, 0x4e, 0x47]], // .PNG
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38],
    ], // GIF8
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP)
  }

  const expectedBytes = magicBytes[mimeType]
  if (!expectedBytes) return true // Unknown type, allow

  return expectedBytes.some((expected) =>
    expected.every((byte, i) => buffer[i] === byte)
  )
}

/**
 * Determine source type from MIME type
 */
export function getSourceType(
  mimeType: string,
  isScanned: boolean
): 'PHOTO' | 'PDF_CLEAN' | 'PDF_SCANNED' {
  if (mimeType === 'application/pdf') {
    return isScanned ? 'PDF_SCANNED' : 'PDF_CLEAN'
  }
  return 'PHOTO'
}
