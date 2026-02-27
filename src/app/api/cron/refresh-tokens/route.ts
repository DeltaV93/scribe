import { NextRequest, NextResponse } from "next/server";
import {
  refreshExpiringTokens,
  getTokenRefreshStats,
} from "@/lib/services/token-refresh";
import { verifyCronRequest } from "@/lib/cron/verify";

/**
 * POST /api/cron/refresh-tokens - Scheduled job to refresh expiring OAuth tokens
 *
 * This endpoint should be called every 5 minutes by a cron job.
 * It proactively refreshes tokens that will expire within 15 minutes,
 * preventing auth failures during API calls.
 *
 * Secured with CRON_SECRET environment variable.
 *
 * Call schedule: Every 5 minutes (* /5 * * * *)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate cron secret with timing-safe comparison
    const verification = verifyCronRequest(request);

    if (!verification.verified) {
      const statusCode = verification.reason === "missing_secret" ? 500 : 401;
      const message =
        verification.reason === "missing_secret"
          ? "Cron not configured"
          : "Invalid cron secret";
      return NextResponse.json(
        { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
        { status: statusCode }
      );
    }

    // Run the refresh job
    const result = await refreshExpiringTokens({
      refreshBeforeExpiryMinutes: 15,
      verbose: process.env.NODE_ENV !== "production",
    });

    console.log("[TokenRefresh Cron] Completed:", {
      refreshed: result.refreshed,
      failed: result.failed,
      durationMs: result.durationMs,
    });

    // Return success even if some tokens failed (individual failures are handled)
    return NextResponse.json({
      success: true,
      data: {
        refreshed: result.refreshed,
        failed: result.failed,
        failedTokenIds: result.failedTokenIds,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error("[TokenRefresh Cron] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Token refresh job failed" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/refresh-tokens - Health check / status
 */
export async function GET(request: NextRequest) {
  // Validate cron secret with timing-safe comparison
  const verification = verifyCronRequest(request);

  if (!verification.verified) {
    const statusCode = verification.reason === "missing_secret" ? 500 : 401;
    const message =
      verification.reason === "missing_secret"
        ? "Cron not configured"
        : "Invalid cron secret";
    return NextResponse.json(
      { error: { code: statusCode === 500 ? "SERVER_ERROR" : "UNAUTHORIZED", message } },
      { status: statusCode }
    );
  }

  try {
    const stats = await getTokenRefreshStats();

    return NextResponse.json({
      success: true,
      data: {
        status: "healthy",
        totalTokens: stats.total,
        tokensByType: stats.byType,
        expiringSoon: stats.expiringSoon,
        expired: stats.expired,
      },
    });
  } catch (error) {
    console.error("[TokenRefresh Cron] Status check error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get token stats" } },
      { status: 500 }
    );
  }
}
