import type { TextExtractionResult } from "./types";

/**
 * Text extraction service for documents
 *
 * This module handles extracting text content from various file types.
 * For production use, consider integrating:
 * - pdf-parse or pdf.js for PDFs
 * - mammoth for DOCX
 * - Apache Tika for universal extraction
 * - Cloud services (Google Document AI, AWS Textract)
 */

/**
 * Extract text from a PDF file
 *
 * Uses a simplified approach for the implementation.
 * In production, use pdf-parse or similar library.
 */
export async function extractTextFromPDF(
  content: Buffer
): Promise<TextExtractionResult> {
  try {
    // Check for PDF signature
    const pdfSignature = content.slice(0, 4).toString("ascii");
    if (pdfSignature !== "%PDF") {
      return {
        success: false,
        error: "Invalid PDF file",
      };
    }

    // Extract text content using regex patterns
    // This is a simplified implementation - production should use pdf-parse
    const contentString = content.toString("latin1");

    // Find text streams in PDF
    const textMatches: string[] = [];

    // Look for text within BT...ET blocks (text blocks)
    const textBlockRegex = /BT[\s\S]*?ET/g;
    const blocks = contentString.match(textBlockRegex) || [];

    for (const block of blocks) {
      // Extract text from Tj and TJ operators
      const tjMatches = block.match(/\((.*?)\)\s*Tj/g) || [];
      const tjArrayMatches = block.match(/\[(.*?)\]\s*TJ/g) || [];

      for (const match of tjMatches) {
        const text = match.match(/\((.*?)\)/)?.[1];
        if (text) {
          textMatches.push(decodeEscapedText(text));
        }
      }

      for (const match of tjArrayMatches) {
        const arrayContent = match.match(/\[(.*?)\]/)?.[1];
        if (arrayContent) {
          const texts = arrayContent.match(/\((.*?)\)/g) || [];
          for (const t of texts) {
            const text = t.slice(1, -1);
            if (text) {
              textMatches.push(decodeEscapedText(text));
            }
          }
        }
      }
    }

    // Also look for plain text streams
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(contentString)) !== null) {
      const streamContent = streamMatch[1];
      // Only include if it looks like readable text
      if (/^[\x20-\x7E\s]+$/.test(streamContent) && streamContent.length > 10) {
        textMatches.push(streamContent.trim());
      }
    }

    // Count pages (look for /Page objects)
    const pageCount = (contentString.match(/\/Type\s*\/Page[^s]/g) || []).length;

    // Extract metadata
    const metadata: Record<string, string> = {};
    const titleMatch = contentString.match(/\/Title\s*\((.*?)\)/);
    const authorMatch = contentString.match(/\/Author\s*\((.*?)\)/);
    const creatorMatch = contentString.match(/\/Creator\s*\((.*?)\)/);

    if (titleMatch) metadata.title = decodeEscapedText(titleMatch[1]);
    if (authorMatch) metadata.author = decodeEscapedText(authorMatch[1]);
    if (creatorMatch) metadata.creator = decodeEscapedText(creatorMatch[1]);

    const extractedText = textMatches
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      success: true,
      text: extractedText || "(No extractable text found)",
      pageCount: pageCount || 1,
      metadata,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "PDF extraction failed",
    };
  }
}

/**
 * Decode escaped characters in PDF text
 */
function decodeEscapedText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Extract text from a plain text file
 */
export async function extractTextFromPlainText(
  content: Buffer
): Promise<TextExtractionResult> {
  try {
    // Detect encoding (simplified - assumes UTF-8)
    const text = content.toString("utf8");

    return {
      success: true,
      text,
      metadata: {
        encoding: "utf-8",
        lineCount: String(text.split("\n").length),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Text extraction failed",
    };
  }
}

/**
 * Extract text from a CSV file
 */
export async function extractTextFromCSV(
  content: Buffer
): Promise<TextExtractionResult> {
  try {
    const text = content.toString("utf8");
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0]?.split(",").map((h) => h.trim());

    return {
      success: true,
      text,
      metadata: {
        encoding: "utf-8",
        rowCount: String(lines.length),
        columnCount: String(headers?.length || 0),
        headers: headers?.join(", ") || "",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "CSV extraction failed",
    };
  }
}

/**
 * Extract text from a DOCX file
 *
 * DOCX files are ZIP archives containing XML.
 * This is a simplified implementation - production should use mammoth or similar.
 */
export async function extractTextFromDOCX(
  content: Buffer
): Promise<TextExtractionResult> {
  try {
    // Check for ZIP signature (DOCX is a ZIP file)
    if (content[0] !== 0x50 || content[1] !== 0x4b) {
      return {
        success: false,
        error: "Invalid DOCX file",
      };
    }

    // For a proper implementation, you would:
    // 1. Unzip the file
    // 2. Parse word/document.xml
    // 3. Extract text from <w:t> elements

    // Simplified: Look for text patterns in the raw content
    const contentString = content.toString("utf8");
    const textMatches: string[] = [];

    // Find text within <w:t> tags
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(contentString)) !== null) {
      if (match[1]) {
        textMatches.push(match[1]);
      }
    }

    const extractedText = textMatches.join(" ").replace(/\s+/g, " ").trim();

    return {
      success: true,
      text: extractedText || "(No extractable text found)",
      metadata: {
        format: "docx",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "DOCX extraction failed",
    };
  }
}

/**
 * Main text extraction function
 * Routes to appropriate extractor based on MIME type
 */
export async function extractText(
  content: Buffer,
  mimeType: string
): Promise<TextExtractionResult> {
  switch (mimeType) {
    case "application/pdf":
      return extractTextFromPDF(content);

    case "text/plain":
      return extractTextFromPlainText(content);

    case "text/csv":
      return extractTextFromCSV(content);

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDOCX(content);

    case "application/msword":
      // Old .doc format - would need different handling
      return {
        success: false,
        error: "Legacy .doc format not supported. Please convert to .docx",
      };

    default:
      return {
        success: false,
        error: `Text extraction not supported for ${mimeType}`,
      };
  }
}
