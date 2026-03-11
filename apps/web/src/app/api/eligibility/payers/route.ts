/**
 * Payers List API Route
 *
 * Returns list of supported insurance payers.
 *
 * GET /api/eligibility/payers
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPayerList } from "@/lib/services/eligibility";

/**
 * GET /api/eligibility/payers
 *
 * Get list of supported payers for eligibility checks.
 *
 * Query params:
 * - type: Filter by payer type (commercial, medicaid, medicare, other)
 * - search: Search payer name
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.toLowerCase();

    // Get payer list
    let payers = await getPayerList();

    // Filter by type if specified
    if (type) {
      payers = payers.filter((p) => p.type === type);
    }

    // Filter by search term if specified
    if (search) {
      payers = payers.filter((p) => p.name.toLowerCase().includes(search));
    }

    return NextResponse.json({
      success: true,
      data: payers,
    });
  } catch (error) {
    console.error("Error fetching payers:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch payers" } },
      { status: 500 }
    );
  }
}
