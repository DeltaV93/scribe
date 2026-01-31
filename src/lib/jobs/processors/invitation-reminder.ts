/**
 * Invitation Reminder Job Processor
 *
 * Processes pending invitations that need reminder emails.
 * Invitations are eligible for reminders if they are 3+ days old and haven't
 * received a reminder yet.
 */

import { Job } from "bullmq";
import { registerProcessor } from "../worker";
import { InvitationReminderJobData } from "../queue";
import {
  getInvitationsNeedingReminder,
  markReminderSent,
  getInvitationUrl,
} from "@/lib/services/user-invitation";
import { sendInvitationReminderEmail } from "@/lib/services/email-notifications";

/**
 * Process invitation reminder job
 *
 * This job:
 * 1. Queries for invitations that need reminders (3+ days old, no reminder sent)
 * 2. Sends a reminder email for each
 * 3. Marks the reminder as sent
 */
async function processInvitationReminder(
  job: Job<InvitationReminderJobData>
): Promise<void> {
  const { orgId } = job.data;

  console.log(
    `[InvitationReminder] Processing reminders${orgId ? ` for org ${orgId}` : " for all orgs"}...`
  );

  const errors: string[] = [];
  let sent = 0;

  // Get invitations needing reminders
  const invitations = await getInvitationsNeedingReminder(orgId);

  console.log(
    `[InvitationReminder] Found ${invitations.length} invitations needing reminders`
  );

  // Process each invitation
  for (const invitation of invitations) {
    try {
      console.log(
        `[InvitationReminder] Sending reminder to ${invitation.email} (${invitation.id})`
      );

      // Send reminder email
      await sendInvitationReminderEmail(invitation.email, {
        inviteeName: invitation.name,
        organizationName: invitation.organization.name,
        inviteUrl: getInvitationUrl(invitation.token),
        expiresAt: invitation.expiresAt,
      });

      // Mark reminder as sent
      await markReminderSent(invitation.id);

      sent++;
      console.log(
        `[InvitationReminder] Successfully sent reminder to ${invitation.email}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Invitation ${invitation.id}: ${errorMessage}`);
      console.error(
        `[InvitationReminder] Error processing invitation ${invitation.id}:`,
        error
      );
    }

    // Update job progress
    await job.updateProgress(
      Math.round(((sent + errors.length) / invitations.length) * 100)
    );
  }

  console.log(
    `[InvitationReminder] Complete. Checked: ${invitations.length}, Sent: ${sent}, Errors: ${errors.length}`
  );

  if (errors.length > 0) {
    console.error("[InvitationReminder] Errors:", errors);
  }
}

// Register this processor
registerProcessor("invitation-reminder", processInvitationReminder);
