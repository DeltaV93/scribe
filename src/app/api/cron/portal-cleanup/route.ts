import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/services/portal-sessions";
import { cleanupExpiredVerifications } from "@/lib/services/phone-verification";
import { cleanupExpiredTokens } from "@/lib/services/portal-tokens";
import { verifyCronRequest } from "@/lib/cron/verify";

/**
 * DELETE /api/cron/portal-cleanup - Clean up expired portal data
 *
 * This endpoint should be called periodically (e.g., every hour) by a cron job.
 * It cleans up:
 * - Expired portal sessions (24hr+ past expiry)
 * - Expired phone verifications
 * - Expired portal tokens (magic links)
 *
 * Secured with CRON_SECRET environment variable.
 */
export async function DELETE(request: NextRequest) {
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

    // Run cleanup tasks in parallel
    const [sessionsDeleted, verificationsDeleted, tokensDeleted] = await Promise.all([
      cleanupExpiredSessions(),
      cleanupExpiredVerifications(),
      cleanupExpiredTokens(),
    ]);

    const totalDeleted = sessionsDeleted + verificationsDeleted + tokensDeleted;

    console.log(`Portal cleanup completed: ${totalDeleted} records deleted`, {
      sessionsDeleted,
      verificationsDeleted,
      tokensDeleted,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionsDeleted,
        verificationsDeleted,
        tokensDeleted,
        totalDeleted,
      },
    });
  } catch (error) {
    console.error("Error during portal cleanup:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 }
    );
  }
}
