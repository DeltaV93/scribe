import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { cloneMetric } from "@/lib/services/reports";

// Validation schema for cloning a metric
const cloneMetricSchema = z.object({
  baseMetricId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  calculation: z.record(z.unknown()).optional(),
});

/**
 * POST /api/reports/metrics/clone - Clone a pre-built metric for customization
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = cloneMetricSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const customMetric = await cloneMetric(
      validation.data.baseMetricId,
      user.orgId,
      user.id,
      {
        name: validation.data.name,
        description: validation.data.description,
        calculation: validation.data.calculation,
      }
    );

    return NextResponse.json(
      { data: customMetric },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error cloning metric:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to clone metric" } },
      { status: 500 }
    );
  }
}
