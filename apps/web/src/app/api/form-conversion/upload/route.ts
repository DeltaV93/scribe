import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { startConversion } from "@/lib/services/form-conversion";
import { addJob, createJobProgress, FormConversionJobData, isRedisConfigured } from "@/lib/jobs";
import { isFeatureEnabled } from "@/lib/features/flags";
import { prisma } from "@/lib/db";
import { secureUpload, S3BucketType, isSecureS3Configured } from "@/lib/storage/s3";

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

    // Upload file to S3 if configured
    if (isSecureS3Configured()) {
      const uploadResult = await secureUpload(
        S3BucketType.UPLOADS,
        conversion.sourcePath,
        buffer,
        {
          contentType: mimeType,
          metadata: {
            "conversion-id": result.conversionId,
            "org-id": user.orgId,
            "user-id": user.id,
            "original-filename": filename,
          },
        }
      );

      if (!uploadResult.success) {
        // Clean up the conversion record if upload fails
        await prisma.formConversion.delete({
          where: { id: result.conversionId },
        });
        throw new Error(`Failed to upload file: ${uploadResult.error}`);
      }
    } else {
      // Store file buffer in database as base64 for development/testing
      // This is a fallback when S3 is not configured
      await prisma.formConversion.update({
        where: { id: result.conversionId },
        data: {
          // Store the buffer as base64 in a field (we'll add this to warnings for now)
          warnings: [
            ...(conversion.warnings as string[] || []),
            "S3 not configured - using inline storage",
          ],
        },
      });

      // Store the file content temporarily in metadata for processing
      // Note: This is a workaround for dev environments without S3
      await prisma.$executeRaw`
        UPDATE "FormConversion"
        SET "fieldPositions" = ${JSON.stringify({ fileBuffer: buffer.toString("base64") })}
        WHERE id = ${result.conversionId}
      `;
    }

    // Check if Redis is configured for job queue
    if (!isRedisConfigured()) {
      // Process synchronously when Redis is not available
      const { processConversion } = await import("@/lib/services/form-conversion");

      try {
        await prisma.formConversion.update({
          where: { id: result.conversionId },
          data: { status: "PROCESSING" },
        });

        const processResult = await processConversion(result.conversionId);

        return NextResponse.json(
          {
            success: true,
            data: {
              conversionId: result.conversionId,
              jobId: null,
              status: processResult.status,
              warnings: processResult.warnings,
              processed: true,
            },
            message: "Document uploaded and processed (sync mode)",
          },
          { status: 200 }
        );
      } catch (processError) {
        console.error("Sync processing failed:", processError);
        // Continue to return the job response so user can retry
      }
    }

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
