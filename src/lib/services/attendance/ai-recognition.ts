import { anthropic, EXTRACTION_MODEL } from "@/lib/ai/client";
import { prisma } from "@/lib/db";
import { prepareImageForVision } from "@/lib/image/enhancement";
import { downloadAttendancePhoto } from "./storage";
import { findEnrollmentByCode } from "./attendance-codes";
import type {
  AIExtractionInput,
  AIExtractionResult,
  AIExtractedRecord,
} from "./types";
import type { AttendanceType } from "@prisma/client";

const VISION_MODEL = "claude-sonnet-4-20250514"; // Vision-capable model

/**
 * Generate the system prompt for attendance extraction
 */
function generateSystemPrompt(): string {
  return `You are an AI assistant specialized in reading and extracting data from handwritten attendance sheets. Your task is to accurately extract attendance information from photos of paper attendance sheets.

Key guidelines:
1. Look for QR codes first - they contain enrollment IDs and attendance codes in format "SCRYBE:ATT:{enrollmentId}:{code}"
2. If QR code is unreadable, look for printed attendance codes (format: 2 consonants + 4 numbers, e.g., "BK2847")
3. Identify the attendance status: checkmarks, X marks, or written notes
4. Look for "Present" and "Excused" checkbox columns
5. Extract time in/out values if present (look for time formats like "9:00", "9:15 AM", etc.)
6. Detect signatures (any mark, initials, or scribble in the signature column)
7. Extract any notes written in the notes column

Confidence scoring:
- QR code successfully read: +40 points
- Printed code clearly visible: +35 points
- Checkbox/attendance mark clear: +15 points
- Time values legible: +5 points each
- Signature present: +5 points

Flag for review when:
- Confidence below 70
- No QR code AND no printed code readable
- Ambiguous checkbox marking (both Present and Excused marked)
- Required signature missing
- Multiple interpretations possible`;
}

/**
 * Generate the user prompt with session context
 */
function generateUserPrompt(context: AIExtractionInput["sessionContext"]): string {
  const enrollmentList = context.expectedEnrollments
    .map((e) => `  - ${e.clientName}: Code ${e.attendanceCode}`)
    .join("\n");

  return `Please analyze this attendance sheet photo and extract attendance data for each row.

Session Context:
- Program: ${context.programName}
- Session: ${context.sessionTitle}
- Date: ${context.sessionDate ? context.sessionDate.toLocaleDateString() : "Not specified"}

Expected Enrollees:
${enrollmentList}

Sheet Configuration:
- Time In/Out columns: ${context.config.includeTimeInOut ? "Yes" : "No"}
- Signature column: ${context.config.includeClientSignature ? "Yes" : "No"}
- Notes column: ${context.config.includeNotes ? "Yes" : "No"}

For each row with data, extract:
1. Row number (1-indexed)
2. QR code content (if readable)
3. Printed attendance code (if visible)
4. Attendance status: "PRESENT", "EXCUSED", or "ABSENT" (unmarked = absent)
5. Time in (if applicable and readable)
6. Time out (if applicable and readable)
7. Whether a signature is present
8. Any notes

Return a JSON object with this structure:
{
  "rows": [
    {
      "rowIndex": 1,
      "qrCodeDetected": true/false,
      "qrCodeValue": "string or null",
      "printedCodeDetected": true/false,
      "printedCodeValue": "string or null",
      "attendanceType": "PRESENT" | "EXCUSED" | "ABSENT" | null,
      "timeIn": "HH:MM" or null,
      "timeOut": "HH:MM" or null,
      "signatureDetected": true/false,
      "notes": "string or null",
      "confidence": 0-100,
      "reviewFlags": ["reason1", "reason2"]
    }
  ],
  "overallConfidence": 0-100,
  "sheetQuality": "good" | "fair" | "poor",
  "issues": ["any general issues with the sheet"]
}`;
}

/**
 * Parse AI response into structured records
 */
function parseAIResponse(
  responseText: string,
  context: AIExtractionInput["sessionContext"]
): {
  records: AIExtractedRecord[];
  overallConfidence: number;
} {
  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const records: AIExtractedRecord[] = (parsed.rows || []).map((row: Record<string, unknown>) => {
    // Try to match to enrollment
    let matchedEnrollmentId: string | null = null;
    let matchConfidence = 0;

    // Priority 1: Match by QR code
    if (row.qrCodeDetected && row.qrCodeValue) {
      const qrMatch = (row.qrCodeValue as string).match(/SCRYBE:ATT:([^:]+):([^:]+)/);
      if (qrMatch) {
        matchedEnrollmentId = qrMatch[1];
        matchConfidence = 95;
      }
    }

    // Priority 2: Match by printed code
    if (!matchedEnrollmentId && row.printedCodeDetected && row.printedCodeValue) {
      const enrollment = context.expectedEnrollments.find(
        (e) => e.attendanceCode.toUpperCase() === (row.printedCodeValue as string).toUpperCase()
      );
      if (enrollment) {
        matchedEnrollmentId = enrollment.enrollmentId;
        matchConfidence = row.qrCodeDetected ? 70 : 85; // Lower if QR failed
      }
    }

    const needsReview =
      (row.confidence as number || 0) < 70 ||
      !matchedEnrollmentId ||
      (row.reviewFlags as string[] || []).length > 0;

    return {
      rowIndex: row.rowIndex as number || 0,
      qrCodeDetected: !!row.qrCodeDetected,
      qrCodeValue: (row.qrCodeValue as string) || null,
      printedCodeDetected: !!row.printedCodeDetected,
      printedCodeValue: (row.printedCodeValue as string) || null,
      matchedEnrollmentId,
      matchConfidence,
      attendanceType: (row.attendanceType as AttendanceType) || null,
      timeIn: (row.timeIn as string) || null,
      timeOut: (row.timeOut as string) || null,
      signatureDetected: !!row.signatureDetected,
      notes: (row.notes as string) || null,
      confidence: row.confidence as number || 0,
      needsReview,
      reviewFlags: row.reviewFlags as string[] || [],
    };
  });

  return {
    records,
    overallConfidence: parsed.overallConfidence || 0,
  };
}

/**
 * Extract attendance data from a photo using Claude Vision
 */
export async function extractAttendanceFromPhoto(
  input: AIExtractionInput
): Promise<AIExtractionResult> {
  const startTime = Date.now();

  try {
    // Download the photo from S3
    const photoBuffer = await downloadAttendancePhoto(input.photoPath);

    // Prepare image for Vision API
    const imageDataUrl = await prepareImageForVision(photoBuffer);

    // Build the request
    const systemPrompt = generateSystemPrompt();
    const userPrompt = generateUserPrompt(input.sessionContext);

    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageDataUrl.split(",")[1], // Remove data URL prefix
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in AI response");
    }

    // Parse the response
    const { records, overallConfidence } = parseAIResponse(
      textContent.text,
      input.sessionContext
    );

    return {
      success: true,
      records,
      overallConfidence,
      processingTimeMs: Date.now() - startTime,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  } catch (error) {
    console.error("AI extraction error:", error);
    return {
      success: false,
      records: [],
      overallConfidence: 0,
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Process an attendance upload with AI recognition
 */
export async function processAttendanceUpload(uploadId: string): Promise<{
  success: boolean;
  recordCount: number;
  error?: string;
}> {
  // Get the upload record
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    include: {
      session: {
        include: {
          program: {
            include: {
              enrollments: {
                where: { status: { in: ["ENROLLED", "IN_PROGRESS"] } },
                include: {
                  client: { select: { firstName: true, lastName: true } },
                  attendanceCode: true,
                },
              },
              attendanceSheetConfig: true,
            },
          },
        },
      },
    },
  });

  if (!upload) {
    return { success: false, recordCount: 0, error: "Upload not found" };
  }

  if (!upload.photoPath) {
    return { success: false, recordCount: 0, error: "No photo uploaded" };
  }

  // Update status to processing
  await prisma.attendanceUpload.update({
    where: { id: uploadId },
    data: {
      status: "AI_PROCESSING",
      aiProcessingStartedAt: new Date(),
    },
  });

  try {
    // Build session context
    const config = upload.session.program.attendanceSheetConfig || {
      includeTimeInOut: true,
      includeClientSignature: true,
      includeNotes: true,
    };

    const sessionContext = {
      programName: upload.session.program.name,
      sessionTitle: upload.session.title,
      sessionDate: upload.session.date,
      expectedEnrollments: upload.session.program.enrollments.map((e) => ({
        enrollmentId: e.id,
        clientName: `${e.client.firstName} ${e.client.lastName}`,
        attendanceCode: e.attendanceCode?.code || "",
      })),
      config: {
        includeTimeInOut: config.includeTimeInOut,
        includeClientSignature: config.includeClientSignature,
        includeNotes: config.includeNotes,
      },
    };

    // Run AI extraction
    const result = await extractAttendanceFromPhoto({
      uploadId,
      photoPath: upload.photoPath,
      sessionContext,
    });

    if (!result.success) {
      // Update with error
      await prisma.attendanceUpload.update({
        where: { id: uploadId },
        data: {
          status: "FAILED",
          aiProcessingEndedAt: new Date(),
          aiError: result.error,
          aiRetryCount: { increment: 1 },
        },
      });

      return { success: false, recordCount: 0, error: result.error };
    }

    // Create extracted records
    const createdRecords = await Promise.all(
      result.records.map((record) =>
        prisma.attendanceExtractedRecord.create({
          data: {
            uploadId,
            enrollmentId: record.matchedEnrollmentId,
            attendanceType: record.attendanceType,
            qrCodeDetected: record.qrCodeDetected,
            qrCodeValue: record.qrCodeValue,
            printedCodeDetected: record.printedCodeDetected,
            printedCodeValue: record.printedCodeValue,
            timeIn: record.timeIn ? parseTime(record.timeIn) : null,
            timeOut: record.timeOut ? parseTime(record.timeOut) : null,
            signatureDetected: record.signatureDetected,
            notes: record.notes,
            confidence: record.confidence,
            needsReview: record.needsReview,
            reviewFlag: record.reviewFlags.length > 0 ? record.reviewFlags.join(", ") : null,
          },
        })
      )
    );

    // Update upload status
    await prisma.attendanceUpload.update({
      where: { id: uploadId },
      data: {
        status: "PENDING_REVIEW",
        aiProcessingEndedAt: new Date(),
        aiRawResponse: JSON.parse(JSON.stringify(result)),
        aiExtractedData: JSON.parse(JSON.stringify(result.records)),
        aiConfidence: result.overallConfidence,
      },
    });

    return { success: true, recordCount: createdRecords.length };
  } catch (error) {
    console.error("Error processing attendance upload:", error);

    await prisma.attendanceUpload.update({
      where: { id: uploadId },
      data: {
        status: "FAILED",
        aiProcessingEndedAt: new Date(),
        aiError: error instanceof Error ? error.message : "Unknown error",
        aiRetryCount: { increment: 1 },
      },
    });

    return {
      success: false,
      recordCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse a time string into a Date (using today's date)
 */
function parseTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  // Try various formats
  const formats = [
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
    /^(\d{1,2})(\d{2})\s*(AM|PM)?$/i,
  ];

  for (const format of formats) {
    const match = timeStr.match(format);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();

      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;

      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
  }

  return null;
}

/**
 * Retry failed AI processing
 */
export async function retryFailedProcessing(
  uploadId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  const upload = await prisma.attendanceUpload.findUnique({
    where: { id: uploadId },
    select: { aiRetryCount: true, status: true },
  });

  if (!upload) {
    return { success: false, error: "Upload not found" };
  }

  if (upload.status !== "FAILED") {
    return { success: false, error: "Upload is not in failed state" };
  }

  if (upload.aiRetryCount >= maxRetries) {
    return { success: false, error: `Maximum retries (${maxRetries}) exceeded` };
  }

  const result = await processAttendanceUpload(uploadId);
  return { success: result.success, error: result.error };
}
