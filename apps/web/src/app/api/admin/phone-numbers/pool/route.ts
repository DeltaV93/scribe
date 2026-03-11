import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  getPoolNumbers,
  purchaseNumberToPool,
} from "@/lib/services/phone-number-management";

/**
 * GET /api/admin/phone-numbers/pool
 * List all numbers in the organization's pool
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const numbers = await getPoolNumbers(user.orgId);

    return NextResponse.json({ data: numbers });
  } catch (error) {
    console.error("Error fetching pool numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool numbers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/phone-numbers/pool
 * Purchase a new number and add to the pool
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { areaCode } = body;

    const poolNumber = await purchaseNumberToPool(user.orgId, areaCode);

    return NextResponse.json({ data: poolNumber }, { status: 201 });
  } catch (error) {
    console.error("Error purchasing number to pool:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to purchase number" },
      { status: 500 }
    );
  }
}
