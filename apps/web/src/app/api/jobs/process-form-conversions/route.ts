import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processConversion } from "@/lib/services/form-conversion";
import { markJobCompleted, markJobFailed } from "@/lib/jobs";

/**
 * Verify API key using timing-safe comparison to prevent timing attacks
 */
function verifyApiKey(authHeader: string | null, expectedKey: string): boolean {
  if (!authHeader) {
    return false;
  }

  const expectedAuth = `Bearer ${expectedKey}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expectedAuth)
    );
  } catch {
    // Buffers have different lengths - auth invalid
    return false;
  }
}

/**
 * POST /api/jobs/process-form-conversions - Background job to process pending form conversions
 *
 * This endpoint should be called by a cron job or background task runner.
 * It processes form conversions that are still in PENDING status.
 *
 * Security: Protected by API key in production
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key in production
    if (process.env.NODE_ENV === "production") {
      const authHeader = request.headers.get("authorization");
      const expectedKey = process.env.JOBS_API_KEY;

      if (!expectedKey) {
        return NextResponse.json(
          { error: "Jobs API key not configured" },
          { status: 500 }
        );
      }

      if (!verifyApiKey(authHeader, expectedKey)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    console.log("[ProcessFormConversions] Starting batch processing");

    // Find pending conversions
    const pendingConversions = await prisma.formConversion.findMany({
      where: {
        status: "PENDING",
        // Only process conversions created in the last 7 days
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      take: 10, // Process up to 10 at a time
      orderBy: { createdAt: "asc" },
    });

    console.log(`[ProcessFormConversions] Found ${pendingConversions.length} pending conversions`);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conversion of pendingConversions) {
      try {
        console.log(`[ProcessFormConversions] Processing conversion ${conversion.id}`);

        // Find associated job progress record
        const jobProgress = await prisma.jobProgress.findFirst({
          where: {
            type: "form-conversion",
            metadata: {
              path: ["conversionId"],
              equals: conversion.id,
            },
          },
        });

        const result = await processConversion(conversion.id);

        if (result.status === "FAILED") {
          failed++;
          errors.push(`${conversion.id}: ${result.error || "Unknown error"}`);

          if (jobProgress) {
            await markJobFailed(jobProgress.id, result.error || "Processing failed");
          }
        } else {
          processed++;

          if (jobProgress) {
            await markJobCompleted(jobProgress.id, {
              status: result.status,
              fieldsDetected: result.fieldResult?.fields.length || 0,
              confidence: result.fieldResult?.overallConfidence || 0,
            });
          }
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${conversion.id}: ${errorMessage}`);
        console.error(`[ProcessFormConversions] Error processing ${conversion.id}:`, error);

        // Update conversion status to failed
        await prisma.formConversion.update({
          where: { id: conversion.id },
          data: {
            status: "FAILED",
            warnings: [errorMessage],
          },
        });
      }
    }

    console.log(
      `[ProcessFormConversions] Completed: ${processed} processed, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      data: {
        processed,
        failed,
        errors,
      },
    });
  } catch (error) {
    console.error("[ProcessFormConversions] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/process-form-conversions - Health check for the job
 */
export async function GET() {
  // Count pending conversions
  const pendingCount = await prisma.formConversion.count({
    where: {
      status: "PENDING",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return NextResponse.json({
    status: "ok",
    job: "process-form-conversions",
    description: "Processes pending form conversion uploads for OCR and field detection",
    pendingCount,
  });
}
