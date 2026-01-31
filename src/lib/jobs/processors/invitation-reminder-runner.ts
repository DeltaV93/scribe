/**
 * Invitation Reminder Runner
 *
 * This processor runs periodically to check for invitations needing reminders
 * and queues individual jobs for processing.
 *
 * This is designed to be run as a cron job (e.g., daily) or as a repeatable
 * BullMQ job.
 */

import { Job } from "bullmq";
import { getJobQueue, InvitationReminderRunnerData, addJob } from "../queue";
import { registerProcessor } from "../worker";
import { prisma } from "@/lib/db";
import { InvitationStatus } from "@prisma/client";

/**
 * Get organization IDs that have pending invitations needing reminders
 */
async function getOrgsWithPendingReminders(): Promise<string[]> {
  const REMINDER_AFTER_DAYS = 3;
  const reminderThreshold = new Date();
  reminderThreshold.setDate(reminderThreshold.getDate() - REMINDER_AFTER_DAYS);

  const orgs = await prisma.userInvitation.findMany({
    where: {
      status: InvitationStatus.PENDING,
      createdAt: { lte: reminderThreshold },
      reminderSentAt: null,
    },
    select: {
      orgId: true,
    },
    distinct: ["orgId"],
  });

  return orgs.map((o) => o.orgId);
}

/**
 * Process scheduled invitation reminder check
 *
 * This job:
 * 1. Queries for organizations with pending invitations needing reminders
 * 2. Queues individual invitation-reminder jobs for each org
 */
async function processInvitationReminderRunner(
  job: Job<InvitationReminderRunnerData>
): Promise<void> {
  console.log("[InvitationReminderRunner] Checking for invitations needing reminders...");

  const errors: string[] = [];
  let queued = 0;

  // Get orgs with pending reminders
  const orgIds = await getOrgsWithPendingReminders();

  console.log(
    `[InvitationReminderRunner] Found ${orgIds.length} organizations with invitations needing reminders`
  );

  // Queue a job for each org
  for (const orgId of orgIds) {
    try {
      console.log(
        `[InvitationReminderRunner] Queueing reminder job for org: ${orgId}`
      );

      await addJob("invitation-reminder", {
        orgId,
      });

      queued++;
      console.log(
        `[InvitationReminderRunner] Successfully queued reminder job for org ${orgId}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Org ${orgId}: ${errorMessage}`);
      console.error(
        `[InvitationReminderRunner] Error queueing job for org ${orgId}:`,
        error
      );
    }
  }

  console.log(
    `[InvitationReminderRunner] Complete. Orgs checked: ${orgIds.length}, Jobs queued: ${queued}, Errors: ${errors.length}`
  );
}

/**
 * Register the invitation reminder runner as a repeatable job
 *
 * Call this once on server startup to ensure the job runs daily.
 */
export async function registerInvitationReminderRunner(): Promise<void> {
  const queue = getJobQueue();

  // Remove any existing repeatable jobs with this name
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "invitation-reminder-runner") {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add the repeatable job (runs daily at 9 AM)
  await queue.add(
    "invitation-reminder-runner",
    { type: "invitation-reminder-runner" } as InvitationReminderRunnerData,
    {
      repeat: {
        pattern: "0 9 * * *", // Every day at 9:00 AM
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
    }
  );

  console.log("[InvitationReminderRunner] Registered repeatable job (daily at 9 AM)");
}

/**
 * Manually trigger the invitation reminder check
 *
 * Useful for testing or manual intervention.
 */
export async function triggerInvitationReminderCheck(): Promise<string> {
  const queue = getJobQueue();

  const job = await queue.add(
    "invitation-reminder-runner",
    { type: "invitation-reminder-runner" } as InvitationReminderRunnerData,
    {
      removeOnComplete: true,
    }
  );

  return job.id || "unknown";
}

// Register this processor
registerProcessor("invitation-reminder-runner", processInvitationReminderRunner);
