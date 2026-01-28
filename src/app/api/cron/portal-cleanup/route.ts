import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/services/portal-sessions";
import { cleanupExpiredVerifications } from "@/lib/services/phone-verification";
import { cleanupExpiredTokens } from "@/lib/services/portal-tokens";

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
    // Validate cron secret
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("Authorization");

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "Cron not configured" } },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
        { status: 401 }
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
