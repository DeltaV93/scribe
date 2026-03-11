/**
 * Knowledge Base Document Upload API
 *
 * POST /api/knowledge/upload - Upload a document to create a knowledge entry
 *
 * Accepts multipart/form-data with:
 * - file: PDF, DOCX, TXT, or MD file (required, max 25MB)
 * - title: Entry title (optional, defaults to filename)
 * - category: Category for the entry (optional)
 * - tags: Comma-separated tags (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createKnowledgeEntry } from "@/lib/services/knowledge";
import { extractTextFromPdf } from "@/lib/services/document-extraction/ocr";
import { anthropic, FAST_MODEL } from "@/lib/ai/client";

// Maximum file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Allowed MIME types and their extensions
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/x-markdown": ".md",
};

/**
 * Extract title from filename by removing extension and cleaning up
 */
function deriveTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[-_]+/g, " ") // Replace dashes/underscores with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Generate a summary of the document content using Claude
 */
async function generateSummary(content: string): Promise<string> {
  try {
    // Truncate content if too long (keep first ~10k chars for context)
    const maxContentLength = 10000;
    const truncatedContent =
      content.length > maxContentLength
        ? content.slice(0, maxContentLength) + "\n\n[Content truncated...]"
        : content;

    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Summarize the following document in 2-3 concise sentences. Focus on the key topics, main points, and purpose of the document. Do not include any preamble like "This document..." - just provide the summary directly.

Document content:
${truncatedContent}`,
        },
      ],
    });

    const textContent = response.content[0];
    if (textContent.type === "text") {
      return textContent.text.trim();
    }

    // Fallback if response format is unexpected
    return content.slice(0, 200).trim() + "...";
  } catch (error) {
    console.error("Error generating summary:", error);
    // Fallback to first 200 characters of content
    return content.slice(0, 200).trim() + "...";
  }
}

/**
 * Extract text content from a file based on its MIME type
 */
async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ text: string; error?: string }> {
  try {
    // Handle PDF files
    if (mimeType === "application/pdf") {
      const result = await extractTextFromPdf(buffer);
      if (!result.text || result.text.trim().length === 0) {
        return {
          text: "",
          error: "Could not extract text from PDF. The file may be empty or image-only.",
        };
      }
      return { text: result.text };
    }

    // Handle DOCX files
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // Dynamic import to avoid ESM issues
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || result.value.trim().length === 0) {
        return {
          text: "",
          error: "Could not extract text from DOCX. The file may be empty.",
        };
      }
      return { text: result.value };
    }

    // Handle TXT and MD files
    if (
      mimeType === "text/plain" ||
      mimeType === "text/markdown" ||
      mimeType === "text/x-markdown"
    ) {
      const text = buffer.toString("utf-8");
      if (!text || text.trim().length === 0) {
        return {
          text: "",
          error: "The file appears to be empty.",
        };
      }
      return { text };
    }

    return {
      text: "",
      error: `Unsupported file type: ${mimeType}`,
    };
  } catch (error) {
    console.error("Error extracting text from file:", error);
    return {
      text: "",
      error:
        error instanceof Error
          ? error.message
          : "Failed to extract text from file",
    };
  }
}

/**
 * POST /api/knowledge/upload
 * Upload a document and create a knowledge entry
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const category = formData.get("category") as string | null;
    const tags = formData.get("tags") as string | null;

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No file provided",
          },
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES[file.type]) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Invalid file type. Allowed types: PDF, DOCX, TXT, MD",
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "File too large. Maximum size is 25MB.",
          },
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from file
    const extractionResult = await extractTextFromFile(
      buffer,
      file.type,
      file.name
    );

    if (extractionResult.error || !extractionResult.text) {
      return NextResponse.json(
        {
          error: {
            code: "EXTRACTION_ERROR",
            message:
              extractionResult.error || "Failed to extract text from document",
          },
        },
        { status: 400 }
      );
    }

    // Generate summary using AI
    const summary = await generateSummary(extractionResult.text);

    // Parse tags
    const parsedTags = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    // Create knowledge entry
    const entry = await createKnowledgeEntry({
      orgId: user.orgId,
      createdById: user.id,
      title: title?.trim() || deriveTitle(file.name),
      content: extractionResult.text,
      summary,
      source: "DOCUMENT",
      tags: parsedTags,
      category: category?.trim() || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: entry,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading document to knowledge base:", error);

    // Handle redirect errors from requireAuth
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process document upload",
        },
      },
      { status: 500 }
    );
  }
}
