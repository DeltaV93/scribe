/**
 * Form Conversion Security Service
 *
 * Provides PDF sanitization and security validation for uploaded documents.
 * Helps prevent malicious file uploads and ensures document safety.
 */

import { ConversionSourceType } from '@prisma/client'

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZES = {
  PHOTO: 10 * 1024 * 1024, // 10MB
  PDF: 25 * 1024 * 1024, // 25MB
}

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  PHOTO: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  PDF: ['application/pdf'],
}

// File extension to MIME type mapping
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.heic': ['image/heic'],
  '.heif': ['image/heif'],
  '.pdf': ['application/pdf'],
}

export interface FileValidationResult {
  isValid: boolean
  sourceType: ConversionSourceType | null
  error?: string
  warnings: string[]
}

export interface SanitizedFile {
  buffer: Buffer
  mimeType: string
  originalName: string
  sanitizedName: string
  sizeBytes: number
  sourceType: ConversionSourceType
}

/**
 * Validate a file for form conversion
 */
export function validateFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  const warnings: string[] = []

  // Check file extension
  const extension = getFileExtension(filename).toLowerCase()
  if (!extension) {
    return {
      isValid: false,
      sourceType: null,
      error: 'File must have an extension',
      warnings,
    }
  }

  // Determine source type based on MIME type
  let sourceType: ConversionSourceType | null = null

  if (ALLOWED_MIME_TYPES.PHOTO.includes(mimeType)) {
    sourceType = 'PHOTO'
  } else if (ALLOWED_MIME_TYPES.PDF.includes(mimeType)) {
    // Will be refined to PDF_CLEAN or PDF_SCANNED during processing
    sourceType = 'PDF_CLEAN'
  }

  if (!sourceType) {
    return {
      isValid: false,
      sourceType: null,
      error: `Unsupported file type: ${mimeType}. Allowed types: JPEG, PNG, WebP, HEIC, PDF`,
      warnings,
    }
  }

  // Validate MIME type matches extension
  const allowedMimes = EXTENSION_MIME_MAP[extension]
  if (allowedMimes && !allowedMimes.includes(mimeType)) {
    warnings.push(`File extension ${extension} does not match MIME type ${mimeType}`)
  }

  // Check file size
  const maxSize = sourceType === 'PHOTO' ? MAX_FILE_SIZES.PHOTO : MAX_FILE_SIZES.PDF
  if (sizeBytes > maxSize) {
    return {
      isValid: false,
      sourceType,
      error: `File too large: ${formatFileSize(sizeBytes)}. Maximum: ${formatFileSize(maxSize)}`,
      warnings,
    }
  }

  // Check for suspicious filename patterns
  if (hasSuspiciousFilename(filename)) {
    return {
      isValid: false,
      sourceType,
      error: 'Filename contains suspicious characters',
      warnings,
    }
  }

  return {
    isValid: true,
    sourceType,
    warnings,
  }
}

/**
 * Validate file buffer magic bytes
 */
export function validateMagicBytes(buffer: Buffer, expectedMimeType: string): boolean {
  const magicBytes = buffer.slice(0, 8)

  // JPEG: FF D8 FF
  if (expectedMimeType === 'image/jpeg') {
    return magicBytes[0] === 0xff && magicBytes[1] === 0xd8 && magicBytes[2] === 0xff
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (expectedMimeType === 'image/png') {
    return (
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4e &&
      magicBytes[3] === 0x47
    )
  }

  // PDF: 25 50 44 46 (%PDF)
  if (expectedMimeType === 'application/pdf') {
    return (
      magicBytes[0] === 0x25 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x44 &&
      magicBytes[3] === 0x46
    )
  }

  // WebP: 52 49 46 46 (RIFF)
  if (expectedMimeType === 'image/webp') {
    return (
      magicBytes[0] === 0x52 &&
      magicBytes[1] === 0x49 &&
      magicBytes[2] === 0x46 &&
      magicBytes[3] === 0x46
    )
  }

  // HEIC/HEIF: Check for ftyp box
  if (expectedMimeType === 'image/heic' || expectedMimeType === 'image/heif') {
    // Skip first 4 bytes (box size), check for 'ftyp'
    return (
      magicBytes[4] === 0x66 &&
      magicBytes[5] === 0x74 &&
      magicBytes[6] === 0x79 &&
      magicBytes[7] === 0x70
    )
  }

  return false
}

/**
 * Sanitize a filename to remove potentially dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  // Get extension
  const extension = getFileExtension(filename)

  // Get base name and sanitize
  const baseName = filename.slice(0, filename.length - extension.length)

  // Replace dangerous characters
  const sanitized = baseName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove dangerous chars
    .replace(/\.+/g, '_') // Replace multiple dots
    .replace(/\s+/g, '_') // Replace spaces
    .replace(/_+/g, '_') // Collapse multiple underscores
    .trim()
    .slice(0, 100) // Limit length

  // Generate unique suffix
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 6)

  return `${sanitized}_${timestamp}_${random}${extension.toLowerCase()}`
}

/**
 * Check PDF for potentially dangerous content
 */
export async function scanPdfForThreats(buffer: Buffer): Promise<{
  isSafe: boolean
  threats: string[]
}> {
  const threats: string[] = []
  const content = buffer.toString('latin1')

  // Check for JavaScript
  if (/\/JavaScript\s/i.test(content) || /\/JS\s/i.test(content)) {
    threats.push('PDF contains JavaScript')
  }

  // Check for embedded files
  if (/\/EmbeddedFile\s/i.test(content)) {
    threats.push('PDF contains embedded files')
  }

  // Check for launch actions
  if (/\/Launch\s/i.test(content)) {
    threats.push('PDF contains launch actions')
  }

  // Check for URIs (might be phishing)
  if (/\/URI\s/i.test(content)) {
    // This is just a warning, not a threat
    // Many legitimate PDFs have URIs
  }

  // Check for forms with submit actions
  if (/\/SubmitForm\s/i.test(content)) {
    threats.push('PDF contains form submission actions')
  }

  // Check for external streams
  if (/\/F\s*\(/i.test(content) && /\/EF\s/i.test(content)) {
    threats.push('PDF may reference external files')
  }

  return {
    isSafe: threats.length === 0,
    threats,
  }
}

/**
 * Determine if a PDF is scanned (image-based) or native (text-based)
 */
export function isPdfScanned(textContent: string, pageCount: number): boolean {
  if (!textContent || textContent.trim().length === 0) {
    return true
  }

  // Calculate average characters per page
  const avgCharsPerPage = textContent.length / Math.max(pageCount, 1)

  // A scanned PDF typically has very little extractable text
  // A typical form page has at least 200 characters of text
  return avgCharsPerPage < 100
}

// Helper functions

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(lastDot) : ''
}

function hasSuspiciousFilename(filename: string): boolean {
  // Check for null bytes
  if (filename.includes('\0')) return true

  // Check for path traversal
  if (filename.includes('..')) return true

  // Check for common script extensions hidden
  const suspiciousPatterns = [
    /\.exe$/i,
    /\.dll$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.ps1$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.sh$/i,
    /\.php$/i,
    /\.asp$/i,
  ]

  return suspiciousPatterns.some((pattern) => pattern.test(filename))
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
