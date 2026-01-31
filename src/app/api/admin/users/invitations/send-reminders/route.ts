import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { addJob } from "@/lib/jobs/queue";
import {
  getInvitationsNeedingReminder,
  markReminderSent,
  getInvitationUrl,
} from "@/lib/services/user-invitation";
import { sendInvitationReminderEmail } from "@/lib/services/email-notifications";

/**
 * POST /api/admin/users/invitations/send-reminders
 * Manually trigger invitation reminder emails for the organization
 *
 * Query params:
 *   - async: if "true", queue a background job instead of processing immediately
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

    const { searchParams } = new URL(request.url);
    const isAsync = searchParams.get("async") === "true";

    if (isAsync) {
      // Queue a background job
      const jobId = await addJob("invitation-reminder", {
        orgId: user.orgId,
      });

      return NextResponse.json({
        message: "Invitation reminder job queued",
        jobId,
      });
    }

    // Process immediately (synchronous)
    const invitations = await getInvitationsNeedingReminder(user.orgId);

    if (invitations.length === 0) {
      return NextResponse.json({
        message: "No invitations need reminders",
        sent: 0,
        errors: [],
      });
    }

    const results = {
      sent: 0,
      errors: [] as { email: string; error: string }[],
    };

    for (const invitation of invitations) {
      try {
        await sendInvitationReminderEmail(invitation.email, {
          inviteeName: invitation.name,
          organizationName: invitation.organization.name,
          inviteUrl: getInvitationUrl(invitation.token),
          expiresAt: invitation.expiresAt,
        });

        await markReminderSent(invitation.id);
        results.sent++;
      } catch (error) {
        results.errors.push({
          email: invitation.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: `Sent ${results.sent} reminder(s)`,
      sent: results.sent,
      errors: results.errors,
    });
  } catch (error) {
    console.error("Error sending invitation reminders:", error);
    return NextResponse.json(
      { error: "Failed to send invitation reminders" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/invitations/send-reminders
 * Get list of invitations that would receive reminders
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invitations = await getInvitationsNeedingReminder(user.orgId);

    return NextResponse.json({
      count: invitations.length,
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        name: inv.name,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching invitations needing reminders:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}
