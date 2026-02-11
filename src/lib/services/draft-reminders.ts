/**
 * Draft Reminder Notification Service (PX-725)
 * Sends reminders to activate draft sessions before their scheduled date
 */

import { prisma } from "@/lib/db";
import { NotificationType, SessionStatus } from "@prisma/client";
import { sendEmail, wrapEmailContent } from "@/lib/email/service";

// Reminder thresholds in days before session date
const REMINDER_THRESHOLDS = [7, 3, 1] as const;

export interface DraftReminderResult {
  sessionsChecked: number;
  remindersCreated: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Check for draft sessions approaching their scheduled date
 * and send reminders to the program manager/facilitator
 *
 * Should be called by a cron job daily
 */
export async function processDraftReminders(): Promise<DraftReminderResult> {
  const result: DraftReminderResult = {
    sessionsChecked: 0,
    remindersCreated: 0,
    emailsSent: 0,
    errors: [],
  };

  try {
    // Get all draft sessions with upcoming dates
    const now = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + Math.max(...REMINDER_THRESHOLDS));

    const draftSessions = await prisma.programSession.findMany({
      where: {
        status: SessionStatus.DRAFT,
        date: {
          gte: now,
          lte: maxFutureDate,
        },
      },
      include: {
        program: {
          include: {
            facilitator: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            creator: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    result.sessionsChecked = draftSessions.length;

    for (const session of draftSessions) {
      try {
        const daysUntilSession = Math.ceil(
          (session.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we should send a reminder at this threshold
        const matchingThreshold = REMINDER_THRESHOLDS.find(
          (threshold) => daysUntilSession <= threshold
        );

        if (!matchingThreshold) continue;

        // Determine who to notify (facilitator first, then creator)
        const recipient = session.program.facilitator || session.program.creator;
        if (!recipient) {
          result.errors.push(`Session ${session.id}: No recipient found`);
          continue;
        }

        // Check if we already sent a reminder for this threshold
        const existingReminder = await prisma.notification.findFirst({
          where: {
            userId: recipient.id,
            type: NotificationType.REMINDER,
            metadata: {
              path: ["sessionId"],
              equals: session.id,
            },
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Within last 24 hours
            },
          },
        });

        if (existingReminder) continue;

        // Create in-app notification
        const urgencyText = daysUntilSession === 1 ? "tomorrow" : `in ${daysUntilSession} days`;
        const notificationTitle = `Session "${session.title || `Session on ${session.date.toLocaleDateString()}`}" is still in draft`;
        const notificationBody = `This session is scheduled ${urgencyText} but hasn't been activated yet. Activate it to allow attendance tracking.`;

        await prisma.notification.create({
          data: {
            orgId: session.program.organization.id,
            userId: recipient.id,
            type: NotificationType.REMINDER,
            title: notificationTitle,
            body: notificationBody,
            actionUrl: `/programs/${session.programId}/sessions/${session.id}`,
            metadata: {
              sessionId: session.id,
              programId: session.programId,
              daysUntil: daysUntilSession,
              threshold: matchingThreshold,
            },
            expiresAt: session.date, // Expires when the session date passes
          },
        });

        result.remindersCreated++;

        // Send email notification
        try {
          const emailContent = `
            <h2 style="margin: 0 0 16px; color: #1a1a2e;">Draft Session Reminder</h2>
            <p style="margin: 0 0 16px; color: #374151;">
              Hi ${recipient.name || "there"},
            </p>
            <p style="margin: 0 0 16px; color: #374151;">
              The session <strong>"${session.title || `Session on ${session.date.toLocaleDateString()}`}"</strong>
              in program <strong>"${session.program.name}"</strong> is scheduled ${urgencyText}
              but is still in <strong>draft status</strong>.
            </p>
            <p style="margin: 0 0 24px; color: #374151;">
              Please activate the session to enable attendance tracking and participant management.
            </p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/programs/${session.programId}/sessions/${session.id}"
               style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Session
            </a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #6b7280;">
              You're receiving this reminder because you're ${session.program.facilitator ? "the facilitator" : "the program creator"} for this program.
            </p>
          `;

          await sendEmail({
            to: recipient.email,
            subject: `[Action Required] Draft session "${session.title || "Untitled"}" is scheduled ${urgencyText}`,
            htmlBody: wrapEmailContent(emailContent, { title: "Draft Session Reminder" }),
            textBody: `Draft Session Reminder\n\nThe session "${session.title}" in program "${session.program.name}" is scheduled ${urgencyText} but is still in draft status.\n\nPlease visit ${process.env.NEXT_PUBLIC_APP_URL}/programs/${session.programId}/sessions/${session.id} to activate it.`,
          });

          result.emailsSent++;
        } catch (emailError) {
          result.errors.push(
            `Session ${session.id}: Email failed - ${emailError instanceof Error ? emailError.message : "Unknown error"}`
          );
        }
      } catch (sessionError) {
        result.errors.push(
          `Session ${session.id}: ${sessionError instanceof Error ? sessionError.message : "Unknown error"}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

/**
 * Get upcoming draft sessions for a specific user (for dashboard display)
 */
export async function getUpcomingDraftSessions(userId: string) {
  const now = new Date();
  const maxFutureDate = new Date();
  maxFutureDate.setDate(maxFutureDate.getDate() + 7); // Show up to 7 days out

  return prisma.programSession.findMany({
    where: {
      status: SessionStatus.DRAFT,
      date: {
        gte: now,
        lte: maxFutureDate,
      },
      program: {
        OR: [
          { facilitatorId: userId },
          { creatorId: userId },
        ],
      },
    },
    include: {
      program: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Get count of unread draft reminders for a user
 */
export async function getUnreadDraftReminderCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      type: NotificationType.REMINDER,
      isRead: false,
      metadata: {
        path: ["sessionId"],
        not: null,
      },
    },
  });
}

/**
 * Dismiss (mark as read) all draft reminders for a session
 * Called when a session is activated
 */
export async function dismissSessionReminders(sessionId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      type: NotificationType.REMINDER,
      metadata: {
        path: ["sessionId"],
        equals: sessionId,
      },
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
