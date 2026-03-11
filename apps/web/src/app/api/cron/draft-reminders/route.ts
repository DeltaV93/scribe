/**
 * Draft Reminders Cron Endpoint (PX-725)
 * POST: Process draft session reminders
 *
 * Should be called daily by a cron job (e.g., Vercel Cron)
 */

import { NextRequest, NextResponse } from "next/server";
import { processDraftReminders } from "@/lib/services/draft-reminders";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In development, allow without secret
    return process.env.NODE_ENV === "development";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST /api/cron/draft-reminders
 * Process draft session reminders
 *
 * Requires CRON_SECRET authorization in production
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const result = await processDraftReminders();

    console.log("[CRON] Draft reminders processed:", result);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[CRON] Draft reminders failed:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron (which uses GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
