import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/verify";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/cron/notification-cleanup - Clean up expired notifications
 *
 * This endpoint should be called periodically (e.g., daily) by a cron job.
 * It deletes notifications that have passed their expiry date (90 days after creation).
 *
 * Per the Goals Hub spec, notifications have a 90-day retention period.
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

    const now = new Date();

    // Delete notifications where expiresAt has passed
    const deleteResult = await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    // Also delete very old read notifications (180+ days) regardless of expiresAt
    // This is a safety net for any notifications that might not have had expiresAt set
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    const oldReadResult = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: cutoffDate,
        },
      },
    });

    const totalDeleted = deleteResult.count + oldReadResult.count;

    console.log(`Notification cleanup completed: ${totalDeleted} notifications deleted`, {
      expiredDeleted: deleteResult.count,
      oldReadDeleted: oldReadResult.count,
    });

    return NextResponse.json({
      success: true,
      data: {
        expiredDeleted: deleteResult.count,
        oldReadDeleted: oldReadResult.count,
        totalDeleted,
      },
    });
  } catch (error) {
    console.error("Error during notification cleanup:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Cleanup failed" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/notification-cleanup - Get notification cleanup stats
 *
 * Returns stats about notifications that would be cleaned up.
 * Useful for monitoring and debugging.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate cron secret
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

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    // Get counts
    const [expiredCount, oldReadCount, totalCount] = await Promise.all([
      prisma.notification.count({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      }),
      prisma.notification.count({
        where: {
          isRead: true,
          readAt: {
            lt: cutoffDate,
          },
        },
      }),
      prisma.notification.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total: totalCount,
        pendingCleanup: {
          expired: expiredCount,
          oldRead: oldReadCount,
        },
      },
    });
  } catch (error) {
    console.error("Error getting notification stats:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get stats" } },
      { status: 500 }
    );
  }
}
