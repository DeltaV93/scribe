/**
 * Knowledge Base Stats API
 *
 * GET /api/knowledge/stats - Get knowledge base statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getKnowledgeStats, getKnowledgeTags, getKnowledgeCategories } from "@/lib/services/knowledge";

/**
 * Get knowledge base statistics
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const [stats, tags, categories] = await Promise.all([
      getKnowledgeStats(user.orgId),
      getKnowledgeTags(user.orgId),
      getKnowledgeCategories(user.orgId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        availableTags: tags,
        availableCategories: categories,
      },
    });
  } catch (error) {
    console.error("Error getting knowledge stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get knowledge stats" } },
      { status: 500 }
    );
  }
}
