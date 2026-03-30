/**
 * Integration Push API (PX-1004)
 *
 * POST /api/integrations/push - Create push jobs for outputs
 *
 * Creates push jobs in the queue to be processed asynchronously.
 * Handles single and bulk push operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createPushJob,
  createMultiDestinationPushJobs,
} from "@/lib/integrations/base/push-queue";
import {
  checkOutputSensitivity,
} from "@/lib/integrations/base/sensitivity-check";
import { getUserAccessToken } from "@/lib/integrations/base/user-token-store";
import { isWorkflowPlatformEnabled } from "@/lib/features/flags";
import type { IntegrationPlatform, Prisma } from "@prisma/client";

// ============================================
// Request Schemas
// ============================================

// Only include platforms that are in IntegrationPlatform enum
const pushSingleSchema = z.object({
  outputId: z.string().uuid(),
  platforms: z.array(z.enum([
    "NOTION", "LINEAR", "JIRA", "SLACK",
    "GOOGLE_CALENDAR", "OUTLOOK_CALENDAR", "GOOGLE_DOCS",
  ])),
  destinationConfig: z.record(z.unknown()).optional(),
});

const pushBulkSchema = z.object({
  outputIds: z.array(z.string().uuid()),
});

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await requireAuth();
    if (!user || !user.orgId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Determine if this is a single or bulk push
    if ("outputIds" in body) {
      // Bulk push - push all approved outputs
      return handleBulkPush(user.id, user.orgId, body);
    } else {
      // Single push
      return handleSinglePush(user.id, user.orgId, body);
    }
  } catch (error) {
    console.error("Push API error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to create push job",
        },
      },
      { status: 500 }
    );
  }
}

// ============================================
// Single Push Handler
// ============================================

async function handleSinglePush(
  userId: string,
  orgId: string,
  body: unknown
) {
  // Validate input
  const parseResult = pushSingleSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parseResult.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { outputId, platforms, destinationConfig } = parseResult.data;

  // Verify output exists and belongs to user's org
  const output = await prisma.draftedOutput.findFirst({
    where: {
      id: outputId,
      conversation: {
        organization: { id: orgId },
      },
    },
    include: {
      conversation: {
        select: { orgId: true },
      },
    },
  });

  if (!output) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Output not found" } },
      { status: 404 }
    );
  }

  // Check output status
  if (output.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STATUS",
          message: "Output must be approved before pushing",
        },
      },
      { status: 400 }
    );
  }

  // Check sensitivity - block RESTRICTED/REDACTED outputs
  const sensitivityCheck = await checkOutputSensitivity(outputId);
  if (!sensitivityCheck.canPush) {
    return NextResponse.json(
      {
        error: {
          code: "SENSITIVITY_BLOCKED",
          message: sensitivityCheck.reason || "Output contains sensitive content",
        },
      },
      { status: 403 }
    );
  }

  // Validate user has access to all platforms
  const accessErrors: string[] = [];
  for (const platform of platforms) {
    const enabled = await isWorkflowPlatformEnabled(
      orgId,
      platform as "LINEAR" | "NOTION" | "JIRA" | "SLACK"
    );
    if (!enabled) {
      accessErrors.push(`${platform} is not enabled for your organization`);
      continue;
    }

    const token = await getUserAccessToken(userId, platform as IntegrationPlatform);
    if (!token) {
      accessErrors.push(`You are not connected to ${platform}`);
    }
  }

  if (accessErrors.length > 0) {
    return NextResponse.json(
      {
        error: {
          code: "ACCESS_DENIED",
          message: accessErrors.join("; "),
        },
      },
      { status: 403 }
    );
  }

  // Create push jobs for each platform
  if (platforms.length === 1) {
    const result = await createPushJob({
      outputId,
      platform: platforms[0] as IntegrationPlatform,
      userId,
      orgId,
      destinationConfig: destinationConfig as Prisma.InputJsonValue | undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: result.errorCode || "PUSH_FAILED",
            message: result.error || "Failed to create push job",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: result.jobId,
        platform: platforms[0],
        status: "PENDING",
      },
    });
  } else {
    // Multi-destination push
    const destinations = platforms.map((platform) => ({
      platform: platform as IntegrationPlatform,
      config: destinationConfig as Prisma.InputJsonValue | undefined,
    }));

    const result = await createMultiDestinationPushJobs(
      outputId,
      destinations,
      userId,
      orgId
    );

    return NextResponse.json({
      success: result.failureCount === 0,
      totalProcessed: platforms.length,
      successCount: result.successCount,
      failCount: result.failureCount,
      jobs: result.results.map((r, i) => ({
        id: r.jobId,
        platform: platforms[i],
        status: r.success ? "PENDING" : "FAILED",
        error: r.error,
      })),
    });
  }
}

// ============================================
// Bulk Push Handler
// ============================================

async function handleBulkPush(
  userId: string,
  orgId: string,
  body: unknown
) {
  // Validate input
  const parseResult = pushBulkSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parseResult.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const { outputIds } = parseResult.data;

  // Get all outputs with their destinations
  const outputs = await prisma.draftedOutput.findMany({
    where: {
      id: { in: outputIds },
      conversation: {
        organization: { id: orgId },
      },
      status: "APPROVED",
    },
    select: {
      id: true,
      destinationPlatform: true,
    },
  });

  if (outputs.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: "NO_OUTPUTS",
          message: "No approved outputs found to push",
        },
      },
      { status: 400 }
    );
  }

  // Create push jobs for each output with a destination
  const results: Array<{ outputId: string; success: boolean; jobId?: string; error?: string }> = [];

  for (const output of outputs) {
    if (!output.destinationPlatform) {
      results.push({
        outputId: output.id,
        success: false,
        error: "No destination platform selected",
      });
      continue;
    }

    // Check sensitivity
    const sensitivityCheck = await checkOutputSensitivity(output.id);
    if (!sensitivityCheck.canPush) {
      results.push({
        outputId: output.id,
        success: false,
        error: sensitivityCheck.reason || "Blocked due to sensitivity",
      });
      continue;
    }

    // Check platform access
    const token = await getUserAccessToken(userId, output.destinationPlatform);
    if (!token) {
      results.push({
        outputId: output.id,
        success: false,
        error: `Not connected to ${output.destinationPlatform}`,
      });
      continue;
    }

    // Create push job
    try {
      const jobResult = await createPushJob({
        outputId: output.id,
        platform: output.destinationPlatform,
        userId,
        orgId,
      });

      if (jobResult.success) {
        results.push({
          outputId: output.id,
          success: true,
          jobId: jobResult.jobId,
        });
      } else {
        results.push({
          outputId: output.id,
          success: false,
          error: jobResult.error || "Failed to create push job",
        });
      }
    } catch (error) {
      results.push({
        outputId: output.id,
        success: false,
        error: error instanceof Error ? error.message : "Failed to create job",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: failCount === 0,
    totalProcessed: outputs.length,
    successCount,
    failCount,
    results,
  });
}
