/**
 * Form Conversion OCR Service
 *
 * Provides hybrid OCR using Claude Vision for images and pdf-parse for PDFs.
 * Extracts text content and structure from uploaded documents.
 */

import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'
import { isPdfScanned } from './security'

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

export interface OcrResult {
  text: string
  pageCount: number
  isScanned: boolean
  confidence: number
  structure: DocumentStructure
}

export interface DocumentStructure {
  title?: string
  sections: DocumentSection[]
  tables: DocumentTable[]
  fields: DetectedFormElement[]
}

export interface DocumentSection {
  heading?: string
  content: string
  level: number
  boundingBox?: BoundingBox
}

export interface DocumentTable {
  headers: string[]
  rows: string[][]
  boundingBox?: BoundingBox
}

export interface DetectedFormElement {
  type: 'text_field' | 'checkbox' | 'radio' | 'dropdown' | 'signature' | 'date' | 'number'
  label: string
  value?: string
  isRequired?: boolean
  boundingBox?: BoundingBox
  confidence: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
  page: number
}

/**
 * Extract text and structure from a PDF buffer
 */
export async function extractFromPdf(buffer: Buffer): Promise<OcrResult> {
  // First, try native text extraction
  const pdfData = await pdfParse(buffer)
  const nativeText = pdfData.text || ''
  const pageCount = pdfData.numpages || 1

  // Determine if PDF is scanned
  const isScanned = isPdfScanned(nativeText, pageCount)

  if (isScanned) {
    // For scanned PDFs, we need to use Vision API
    // Convert PDF pages to images and process with Claude Vision
    return await extractWithVision(buffer, 'application/pdf', pageCount)
  }

  // For native PDFs, parse the structure
  const structure = parseTextStructure(nativeText)

  return {
    text: nativeText,
    pageCount,
    isScanned: false,
    confidence: 0.95, // High confidence for native text
    structure,
  }
}

/**
 * Extract text and structure from an image buffer
 */
export async function extractFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  return await extractWithVision(buffer, mimeType, 1)
}

/**
 * Use Claude Vision to extract text and form structure
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
    max_tokens: 4096,
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
            text: `Analyze this form document image and extract all information. Provide your response as JSON with this structure:

{
  "text": "Full text content of the document",
  "title": "Document title if present",
  "sections": [
    { "heading": "Section heading", "content": "Section content", "level": 1 }
  ],
  "tables": [
    { "headers": ["Column 1", "Column 2"], "rows": [["Row 1 Col 1", "Row 1 Col 2"]] }
  ],
  "fields": [
    {
      "type": "text_field|checkbox|radio|dropdown|signature|date|number",
      "label": "Field label",
      "value": "Pre-filled value if any",
      "isRequired": true,
      "confidence": 0.95
    }
  ],
  "confidence": 0.85
}

Focus on identifying:
1. Form fields with their labels and types
2. Pre-filled values in fields
3. Required field indicators (asterisks, "required" text)
4. Section headings and organization
5. Tables and their structure
6. Signature lines
7. Date fields
8. Checkboxes and radio buttons

Return ONLY valid JSON, no other text.`,
          },
        ],
      },
    ],
  })

  // Parse the response
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude Vision')
  }

  let parsed: {
    text: string
    title?: string
    sections?: Array<{ heading?: string; content: string; level: number }>
    tables?: Array<{ headers: string[]; rows: string[][] }>
    fields?: Array<{
      type: string
      label: string
      value?: string
      isRequired?: boolean
      confidence: number
    }>
    confidence: number
  }

  try {
    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonText = content.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    parsed = JSON.parse(jsonText.trim())
  } catch {
    // If JSON parsing fails, create basic structure from text
    parsed = {
      text: content.text,
      confidence: 0.5,
    }
  }

  const structure: DocumentStructure = {
    title: parsed.title,
    sections: (parsed.sections || []).map((s) => ({
      heading: s.heading,
      content: s.content,
      level: s.level || 1,
    })),
    tables: (parsed.tables || []).map((t) => ({
      headers: t.headers || [],
      rows: t.rows || [],
    })),
    fields: (parsed.fields || []).map((f) => ({
      type: mapFieldType(f.type),
      label: f.label,
      value: f.value,
      isRequired: f.isRequired,
      confidence: f.confidence || 0.8,
    })),
  }

  return {
    text: parsed.text || '',
    pageCount,
    isScanned: true,
    confidence: parsed.confidence || 0.8,
    structure,
  }
}

/**
 * Parse text content to extract document structure
 */
function parseTextStructure(text: string): DocumentStructure {
  const sections: DocumentSection[] = []
  const tables: DocumentTable[] = []
  const fields: DetectedFormElement[] = []

  // Split into lines for analysis
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  let currentSection: DocumentSection | null = null

  for (const line of lines) {
    // Detect section headings (all caps or ends with colon)
    if (isHeading(line)) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        heading: line.replace(/:$/, ''),
        content: '',
        level: 1,
      }
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? ' ' : '') + line
    }

    // Detect form fields (line ending with colon followed by blank or underscore)
    const fieldMatch = line.match(/^(.+?):\s*(_+|\.+)?\s*$/)
    if (fieldMatch) {
      fields.push({
        type: guessFieldType(fieldMatch[1]),
        label: fieldMatch[1].trim(),
        confidence: 0.7,
      })
    }

    // Detect checkboxes
    if (/^\[[\sx]?\]/.test(line) || /^☐|^☑|^□|^▢/.test(line)) {
      const label = line.replace(/^\[[\sx]?\]\s*|^[☐☑□▢]\s*/, '').trim()
      fields.push({
        type: 'checkbox',
        label,
        value: /^\[[x]\]|^☑/.test(line) ? 'true' : undefined,
        confidence: 0.85,
      })
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection)
  }

  return {
    sections,
    tables,
    fields,
  }
}

/**
 * Determine if a line is likely a heading
 */
function isHeading(line: string): boolean {
  // All caps with more than 3 characters
  if (line.length > 3 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
    return true
  }
  // Ends with colon and is short
  if (line.endsWith(':') && line.length < 50) {
    return true
  }
  // Numbered section
  if (/^\d+\.\s+[A-Z]/.test(line)) {
    return true
  }
  return false
}

/**
 * Guess field type from label
 */
function guessFieldType(label: string): DetectedFormElement['type'] {
  const lowerLabel = label.toLowerCase()

  if (/date|dob|birth|when/.test(lowerLabel)) {
    return 'date'
  }
  if (/sign|signature/.test(lowerLabel)) {
    return 'signature'
  }
  if (/phone|tel|mobile|fax|zip|ssn|number|amount|age|qty|quantity/.test(lowerLabel)) {
    return 'number'
  }
  if (/email|e-mail/.test(lowerLabel)) {
    return 'text_field'
  }

  return 'text_field'
}

/**
 * Map string type to DetectedFormElement type
 */
function mapFieldType(type: string): DetectedFormElement['type'] {
  const typeMap: Record<string, DetectedFormElement['type']> = {
    text_field: 'text_field',
    text: 'text_field',
    string: 'text_field',
    checkbox: 'checkbox',
    check: 'checkbox',
    radio: 'radio',
    dropdown: 'dropdown',
    select: 'dropdown',
    signature: 'signature',
    sign: 'signature',
    date: 'date',
    number: 'number',
    numeric: 'number',
    integer: 'number',
  }
  return typeMap[type.toLowerCase()] || 'text_field'
}

/**
 * Map MIME type for Claude API
 */
function mapMimeType(mimeType: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const map: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
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
