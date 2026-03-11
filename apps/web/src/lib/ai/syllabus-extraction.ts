import { anthropic, EXTRACTION_MODEL } from "./client";
import {
  generateSyllabusSystemPrompt,
  generateSyllabusExtractionPrompt,
  generateSyllabusVisionPrompt,
  type SyllabusExtractionOptions,
  type SyllabusExtractionResult,
} from "./syllabus-prompts";

// ============================================
// TYPES
// ============================================

export interface SyllabusExtractionInput {
  /** Text content of the document (for PDF/DOCX) */
  textContent?: string;
  /** Base64-encoded image data (for image files) */
  imageData?: string;
  /** MIME type of the image */
  imageMimeType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  /** Optional extraction options */
  options?: SyllabusExtractionOptions;
}

export interface SyllabusExtractionOutput {
  success: boolean;
  data: SyllabusExtractionResult | null;
  tokensUsed: {
    input: number;
    output: number;
  };
  processingTimeMs: number;
  error?: string;
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract syllabus data from a document
 * Supports text-based documents (PDF, DOCX) and images
 */
export async function extractSyllabusData(
  input: SyllabusExtractionInput
): Promise<SyllabusExtractionOutput> {
  const startTime = Date.now();

  if (!input.textContent && !input.imageData) {
    return {
      success: false,
      data: null,
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: Date.now() - startTime,
      error: "Either textContent or imageData must be provided",
    };
  }

  try {
    let response;

    if (input.imageData && input.imageMimeType) {
      // Vision-based extraction for images
      response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 4096,
        system: generateSyllabusSystemPrompt(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.imageMimeType,
                  data: input.imageData,
                },
              },
              {
                type: "text",
                text: generateSyllabusVisionPrompt(),
              },
            ],
          },
        ],
      });
    } else if (input.textContent) {
      // Text-based extraction for PDFs and DOCX
      response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 4096,
        system: generateSyllabusSystemPrompt(),
        messages: [
          {
            role: "user",
            content: generateSyllabusExtractionPrompt(
              input.textContent,
              input.options
            ),
          },
        ],
      });
    } else {
      throw new Error("Invalid input: no content to extract from");
    }

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize and validate the extracted data
    const data = normalizeExtractedData(parsed);

    return {
      success: true,
      data,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Syllabus extraction error:", error);
    return {
      success: false,
      data: null,
      tokensUsed: { input: 0, output: 0 },
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================
// DOCUMENT TEXT EXTRACTION
// ============================================

/**
 * Extract text from a PDF file
 * Uses pdf-parse library (needs to be installed)
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(pdfBuffer);
    return {
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Extract text from a DOCX file
 * Uses mammoth library (needs to be installed)
 */
export async function extractTextFromDocx(
  docxBuffer: Buffer
): Promise<{ text: string }> {
  try {
    // Dynamic import to avoid bundling issues
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    return {
      text: result.value,
    };
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(
      `Failed to extract text from DOCX: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Process a file and extract syllabus data
 * Handles PDF, DOCX, and image files
 */
export async function processFileForExtraction(
  fileBuffer: Buffer,
  mimeType: string,
  options?: SyllabusExtractionOptions
): Promise<SyllabusExtractionOutput> {
  // Handle different file types
  if (mimeType === "application/pdf") {
    const { text } = await extractTextFromPdf(fileBuffer);
    return extractSyllabusData({ textContent: text, options });
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const { text } = await extractTextFromDocx(fileBuffer);
    return extractSyllabusData({ textContent: text, options });
  }

  if (mimeType.startsWith("image/")) {
    const base64Data = fileBuffer.toString("base64");
    const imageMimeType = mimeType as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    return extractSyllabusData({
      imageData: base64Data,
      imageMimeType,
      options,
    });
  }

  return {
    success: false,
    data: null,
    tokensUsed: { input: 0, output: 0 },
    processingTimeMs: 0,
    error: `Unsupported file type: ${mimeType}`,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize and validate extracted syllabus data
 */
function normalizeExtractedData(parsed: any): SyllabusExtractionResult {
  // Ensure sessions is an array
  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions.map((s: any, index: number) => ({
        number: typeof s.number === "number" ? s.number : index + 1,
        title: typeof s.title === "string" ? s.title : `Session ${index + 1}`,
        topic: typeof s.topic === "string" ? s.topic : null,
        durationMinutes:
          typeof s.durationMinutes === "number" ? s.durationMinutes : null,
      }))
    : [];

  // Calculate total hours if not provided
  let totalHours = parsed.totalHours;
  if (typeof totalHours !== "number" && sessions.length > 0) {
    const totalMinutes = sessions.reduce(
      (sum: number, s: any) => sum + (s.durationMinutes || 0),
      0
    );
    totalHours = totalMinutes > 0 ? Math.round((totalMinutes / 60) * 10) / 10 : null;
  }

  return {
    programName:
      typeof parsed.programName === "string" ? parsed.programName : null,
    description:
      typeof parsed.description === "string" ? parsed.description : null,
    sessions,
    totalHours: typeof totalHours === "number" ? totalHours : null,
    learningObjectives: Array.isArray(parsed.learningObjectives)
      ? parsed.learningObjectives.filter((o: any) => typeof o === "string")
      : [],
    prerequisites: Array.isArray(parsed.prerequisites)
      ? parsed.prerequisites.filter((p: any) => typeof p === "string")
      : [],
    extractionConfidence:
      typeof parsed.extractionConfidence === "number"
        ? Math.min(100, Math.max(0, parsed.extractionConfidence))
        : 50,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
  };
}

/**
 * Convert extraction result to bulk session input format
 */
export function extractionToSessionInputs(
  data: SyllabusExtractionResult
): {
  title: string;
  topic: string | null;
  durationMinutes: number | null;
}[] {
  return data.sessions.map((session) => ({
    title: session.title,
    topic: session.topic,
    durationMinutes: session.durationMinutes,
  }));
}

/**
 * Estimate extraction quality based on data completeness
 */
export function estimateExtractionQuality(
  data: SyllabusExtractionResult
): {
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = data.extractionConfidence;

  // Check for missing program name
  if (!data.programName) {
    issues.push("Program name not detected");
    recommendations.push("Manually enter the program name");
    score -= 10;
  }

  // Check for missing sessions
  if (data.sessions.length === 0) {
    issues.push("No sessions detected");
    recommendations.push("Manually add sessions or try a clearer document");
    score -= 30;
  }

  // Check for sessions without durations
  const sessionsWithoutDuration = data.sessions.filter(
    (s) => !s.durationMinutes
  );
  if (sessionsWithoutDuration.length > 0) {
    issues.push(
      `${sessionsWithoutDuration.length} sessions have no duration specified`
    );
    recommendations.push("Review and add session durations");
    score -= 5 * Math.min(sessionsWithoutDuration.length, 5);
  }

  // Check for sessions without topics
  const sessionsWithoutTopic = data.sessions.filter((s) => !s.topic);
  if (sessionsWithoutTopic.length > data.sessions.length / 2) {
    issues.push("Many sessions missing topic descriptions");
    recommendations.push("Consider adding topic details for better tracking");
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    recommendations,
  };
}
