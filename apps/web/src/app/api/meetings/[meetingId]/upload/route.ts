/**
 * Meeting Recording Upload API
 *
 * POST /api/meetings/[meetingId]/upload - Upload a recording file
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile, generateStoragePath } from "@/lib/files/storage";
import { startMeetingProcessing } from "@/lib/services/meetings";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

interface RouteParams {
  params: Promise<{ meetingId: string }>;
}

// Allowed MIME types for meeting recordings
const ALLOWED_MIME_TYPES = [
  "audio/mpeg",      // mp3
  "audio/mp3",       // mp3 (alternative)
  "audio/wav",       // wav
  "audio/x-wav",     // wav (alternative)
  "audio/wave",      // wav (alternative)
  "audio/webm",      // webm audio
  "audio/m4a",       // m4a
  "audio/x-m4a",     // m4a (alternative)
  "audio/mp4",       // m4a as mp4
  "video/mp4",       // mp4
  "video/webm",      // webm video
  "video/quicktime", // mov
];

const ALLOWED_EXTENSIONS = [".mp3", ".mp4", ".wav", ".webm", ".m4a", ".mov"];

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/**
 * Upload a meeting recording
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { meetingId } = await params;

    // Verify meeting exists and belongs to org
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, orgId: user.orgId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Meeting not found" } },
        { status: 404 }
      );
    }

    // Check if already processing
    if (meeting.status === "PROCESSING") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Meeting is already being processed" } },
        { status: 409 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const autoProcess = formData.get("autoProcess") !== "false"; // Default true

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No file provided" } },
        { status: 400 }
      );
    }

    // Validate file type
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const mimeType = file.type;

    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
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
            message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          },
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let storagePath: string;
    let recordingPath: string;

    // Check if S3/Supabase storage is configured
    const hasCloudStorage = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (hasCloudStorage) {
      // Upload to Supabase Storage
      storagePath = generateStoragePath(user.orgId, `meeting-${meetingId}-${file.name}`);
      const uploadResult = await uploadFile(buffer, storagePath, mimeType);

      if (!uploadResult.success) {
        return NextResponse.json(
          { error: { code: "UPLOAD_ERROR", message: uploadResult.error || "Failed to upload file" } },
          { status: 500 }
        );
      }

      recordingPath = `storage://${uploadResult.path}`;
    } else {
      // Save to local filesystem for MVP/development
      const uploadsDir = path.join(process.cwd(), "uploads", "meetings");
      await fs.mkdir(uploadsDir, { recursive: true });

      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString("hex");
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${meetingId}-${timestamp}-${randomId}-${sanitizedName}`;
      const localPath = path.join(uploadsDir, filename);

      await fs.writeFile(localPath, buffer);
      recordingPath = localPath;
    }

    // Update meeting with recording path
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        recordingPath,
      },
    });

    // Auto-start processing if requested
    let processingResult = null;
    if (autoProcess) {
      processingResult = await startMeetingProcessing({
        meetingId,
        orgId: user.orgId,
        userId: user.id,
        recordingPath,
      });
    }

    return NextResponse.json({
      success: true,
      message: autoProcess ? "Recording uploaded and processing started" : "Recording uploaded successfully",
      data: {
        meetingId,
        recordingPath,
        fileSize: file.size,
        fileName: file.name,
        mimeType,
        ...(processingResult && {
          jobProgressId: processingResult.jobProgressId,
          processing: true,
        }),
      },
    });
  } catch (error) {
    console.error("Error uploading meeting recording:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to upload recording" } },
      { status: 500 }
    );
  }
}

/**
 * Get upload constraints
 */
export async function GET() {
  return NextResponse.json({
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    allowedExtensions: ALLOWED_EXTENSIONS,
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
  });
}
