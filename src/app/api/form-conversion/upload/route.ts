import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { startConversion } from "@/lib/services/form-conversion";
import { addJob, createJobProgress, FormConversionJobData } from "@/lib/jobs";
import { isFeatureEnabled } from "@/lib/features/flags";
import { prisma } from "@/lib/db";

/**
 * POST /api/form-conversion/upload - Upload a document for form conversion
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if feature is enabled
    const enabled = await isFeatureEnabled(user.orgId, "photo-to-form");
    if (!enabled) {
      return NextResponse.json(
        {
          error: {
            code: "FEATURE_DISABLED",
            message: "Photo/PDF to Form feature is not enabled for this organization",
          },
        },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No file provided" } },
        { status: 400 }
      );
    }

    // Get file details
    const filename = file.name;
    const mimeType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Start conversion
    const result = await startConversion({
      orgId: user.orgId,
      userId: user.id,
      filename,
      mimeType,
      buffer,
    });

    // Get the conversion record to get source type
    const conversion = await prisma.formConversion.findUnique({
      where: { id: result.conversionId },
    });

    if (!conversion) {
      throw new Error("Conversion record not found");
    }

    // TODO: Upload file to S3 here
    // const s3Path = await uploadToS3(buffer, conversion.sourcePath)

    // Create job progress record
    const jobProgress = await createJobProgress({
      type: "form-conversion",
      userId: user.id,
      orgId: user.orgId,
      total: 1,
      metadata: {
        conversionId: result.conversionId,
        filename,
      },
    });

    // Queue the processing job
    const jobData: FormConversionJobData = {
      jobProgressId: jobProgress.id,
      conversionId: result.conversionId,
      sourcePath: conversion.sourcePath,
      sourceType: conversion.sourceType,
      orgId: user.orgId,
      userId: user.id,
    };

    await addJob("form-conversion", jobData, {
      jobId: jobProgress.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          conversionId: result.conversionId,
          jobId: jobProgress.id,
          status: result.status,
          warnings: result.warnings,
        },
        message: "Document uploaded and processing started",
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error uploading document:", error);

    if (error instanceof Error) {
      if (error.message.includes("not enabled")) {
        return NextResponse.json(
          { error: { code: "FEATURE_DISABLED", message: error.message } },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process upload" } },
      { status: 500 }
    );
  }
}
