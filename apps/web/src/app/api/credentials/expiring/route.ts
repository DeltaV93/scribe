import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getExpiringCredentials,
  getCredentialStatsByType,
  getExpirationForecast,
} from "@/lib/services/credentials";
import { prisma } from "@/lib/db";

/**
 * GET /api/credentials/expiring - Get credentials expiring within X days
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Check if workforce feature is enabled
    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { workforceEnabled: true },
    });

    if (!org?.workforceEnabled) {
      return NextResponse.json(
        { error: { code: "FEATURE_DISABLED", message: "Workforce features are not enabled for this organization" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const daysUntilExpiry = parseInt(searchParams.get("days") || "30", 10);
    const includeStats = searchParams.get("includeStats") === "true";
    const includeForecast = searchParams.get("includeForecast") === "true";

    const [expiringCredentials, statsByType, forecast] = await Promise.all([
      getExpiringCredentials(user.orgId, daysUntilExpiry),
      includeStats ? getCredentialStatsByType(user.orgId) : Promise.resolve(null),
      includeForecast ? getExpirationForecast(user.orgId) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        expiringCredentials,
        ...(statsByType && { statsByType }),
        ...(forecast && { expirationForecast: forecast }),
      },
    });
  } catch (error) {
    console.error("Error fetching expiring credentials:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch expiring credentials" } },
      { status: 500 }
    );
  }
}
