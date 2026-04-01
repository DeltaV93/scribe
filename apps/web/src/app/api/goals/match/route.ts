import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { findSimilarGoals } from "@/lib/services/goals";
import { z } from "zod";

// Validation schema for finding similar goals
const matchGoalsSchema = z.object({
  queryText: z.string().min(1, "Query text is required").max(5000),
  threshold: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(50).optional(),
});

/**
 * POST /api/goals/match - Find similar goals for text
 * Uses embedding-based semantic search to find goals matching the query text
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const validation = matchGoalsSchema.safeParse(body);

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

    const { queryText, threshold, topK } = validation.data;

    const matches = await findSimilarGoals(user.orgId, queryText, {
      threshold,
      topK,
    });

    return NextResponse.json({
      success: true,
      data: { matches },
    });
  } catch (error) {
    console.error("Error finding similar goals:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to find similar goals",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
