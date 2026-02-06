import { NextRequest, NextResponse } from "next/server";
import {
  archiveOldDrafts,
  getDraftsForDigestByTimezone,
  getOrgTimezones,
  isDigestDay,
  isDigestTime,
} from "@/lib/services/draft-management";
import { sendDraftDigestEmail } from "@/lib/services/email-notifications";

/**
 * POST /api/cron/draft-digest - Send weekly draft digest emails and archive old drafts
 *
 * This endpoint should be called hourly by a cron job.
 * It checks if it's Monday 9am in any org's timezone and sends digest emails.
 * It also archives drafts that haven't been edited in 30 days.
 *
 * Secured with CRON_SECRET environment variable.
 *
 * Call schedule: Hourly (to catch 9am in different timezones)
 * Email schedule: Monday 9am in each org's configured timezone
 */
export async function POST(request: NextRequest) {
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

    const results = {
      emailsSent: 0,
      draftsArchived: 0,
      timezonesProcessed: [] as string[],
      errors: [] as string[],
    };

    // Step 1: Archive old drafts (always runs)
    try {
      results.draftsArchived = await archiveOldDrafts();
      console.log(`Draft digest: Archived ${results.draftsArchived} old drafts`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.errors.push(`Archive error: ${message}`);
      console.error("Error archiving old drafts:", error);
    }

    // Step 2: Send digest emails for timezones where it's Monday 9am
    const timezones = await getOrgTimezones();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.scrybe.io";

    for (const timezone of timezones) {
      // Check if it's Monday 9am in this timezone
      if (!isDigestDay(timezone) || !isDigestTime(timezone)) {
        continue;
      }

      results.timezonesProcessed.push(timezone);

      try {
        const digests = await getDraftsForDigestByTimezone(timezone);

        for (const digest of digests) {
          if (digest.drafts.length === 0) {
            continue;
          }

          try {
            await sendDraftDigestEmail(digest.userEmail, {
              userName: digest.userName,
              orgName: digest.orgName,
              drafts: digest.drafts,
              appUrl,
            });
            results.emailsSent++;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            results.errors.push(`Email to ${digest.userEmail}: ${message}`);
            console.error(`Error sending digest to ${digest.userEmail}:`, error);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Timezone ${timezone}: ${message}`);
        console.error(`Error processing timezone ${timezone}:`, error);
      }
    }

    console.log("Draft digest cron completed:", results);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error during draft digest cron:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Draft digest failed" } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/draft-digest - Health check / status
 */
export async function GET(request: NextRequest) {
  // Validate cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");

  if (!cronSecret) {
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

  const timezones = await getOrgTimezones();
  const mondayTimezones = timezones.filter(
    (tz) => isDigestDay(tz) && isDigestTime(tz)
  );

  return NextResponse.json({
    success: true,
    data: {
      status: "healthy",
      timezones: timezones.length,
      currentlyMonday9am: mondayTimezones,
    },
  });
}
