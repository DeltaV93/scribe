/**
 * Goal Notifications Service
 *
 * Handles notifications for goal-related events:
 * - Progress milestones (25%, 50%, 75%, 100%)
 * - At-risk status changes
 * - Deadline approaching (30, 14, 7, 1 days)
 * - Goal completion
 *
 * Creates both in-app Notifications and Reminders for actionable items.
 */

import { prisma } from "@/lib/db";
import { GoalStatus, GoalType, NotificationType } from "@prisma/client";
import { createNotification } from "./notifications";
import { sendGoalNotificationEmail } from "@/lib/email/goal-emails";

// ============================================
// TYPES
// ============================================

export type GoalNotificationType =
  | "milestone"
  | "at_risk"
  | "behind"
  | "completed"
  | "deadline_approaching";

export interface NotificationMetadata {
  milestone?: number;
  previousProgress?: number;
  newProgress?: number;
  previousStatus?: GoalStatus;
  newStatus?: GoalStatus;
  daysRemaining?: number;
  completedAt?: string;
}

// ============================================
// NOTIFICATION TRIGGERS
// ============================================

/**
 * Trigger a goal progress notification
 */
export async function triggerGoalProgressNotification(
  goalId: string,
  notificationType: GoalNotificationType,
  metadata: NotificationMetadata
): Promise<void> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      owner: { select: { id: true, email: true, name: true } },
      team: {
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, name: true } },
            },
          },
        },
      },
      organization: {
        include: {
          users: {
            where: {
              role: { in: ["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"] },
            },
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
  });

  if (!goal) {
    console.error(`Goal ${goalId} not found for notification`);
    return;
  }

  // Determine recipients: owner + team members + admins/program managers
  const recipientIds = new Set<string>();
  const recipientEmails = new Map<string, { email: string; name: string | null }>();

  // Add owner
  if (goal.owner) {
    recipientIds.add(goal.owner.id);
    recipientEmails.set(goal.owner.id, {
      email: goal.owner.email,
      name: goal.owner.name,
    });
  }

  // Add team members
  if (goal.team) {
    for (const member of goal.team.members) {
      recipientIds.add(member.user.id);
      recipientEmails.set(member.user.id, {
        email: member.user.email,
        name: member.user.name,
      });
    }
  }

  // Add admins and program managers
  for (const user of goal.organization.users) {
    recipientIds.add(user.id);
    recipientEmails.set(user.id, {
      email: user.email,
      name: user.name,
    });
  }

  // Generate notification content
  const { title, body, type } = generateNotificationContent(
    goal.name,
    goal.type,
    notificationType,
    metadata
  );

  // Create notifications for each recipient
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90-day retention

  for (const userId of recipientIds) {
    try {
      // Create in-app notification
      await createNotification({
        orgId: goal.orgId,
        userId,
        type: type as NotificationType,
        title,
        body,
        actionUrl: `/goals/${goalId}`,
        metadata: {
          goalId,
          goalType: goal.type,
          notificationType,
          ...metadata,
        },
      });

      // Send email notification
      const recipient = recipientEmails.get(userId);
      if (recipient?.email) {
        await sendGoalNotificationEmail({
          to: recipient.email,
          recipientName: recipient.name ?? "there",
          goalName: goal.name,
          goalType: goal.type,
          notificationType,
          metadata,
          actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/goals/${goalId}`,
        }).catch((err) => {
          console.error(`Failed to send email to ${recipient.email}:`, err);
        });
      }
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
    }
  }

  // Create reminder for actionable notifications
  if (notificationType === "at_risk" || notificationType === "deadline_approaching") {
    await createGoalReminder(goal.orgId, goalId, goal.name, notificationType, metadata);
  }
}

/**
 * Generate notification content based on type
 */
function generateNotificationContent(
  goalName: string,
  goalType: GoalType,
  notificationType: GoalNotificationType,
  metadata: NotificationMetadata
): { title: string; body: string; type: string } {
  const typeLabel = goalType.toLowerCase().replace("_", " ");

  switch (notificationType) {
    case "milestone":
      return {
        title: `${goalName} reached ${metadata.milestone}%`,
        body: `Your ${typeLabel} "${goalName}" has reached ${metadata.milestone}% progress.`,
        type: "GOAL_PROGRESS_ALERT",
      };

    case "at_risk":
      return {
        title: `${goalName} is at risk`,
        body: `Your ${typeLabel} "${goalName}" is falling behind schedule and may not meet its deadline.`,
        type: "GOAL_AT_RISK",
      };

    case "behind":
      return {
        title: `${goalName} is behind schedule`,
        body: `Your ${typeLabel} "${goalName}" is significantly behind schedule. Immediate attention required.`,
        type: "GOAL_AT_RISK",
      };

    case "completed":
      return {
        title: `${goalName} completed!`,
        body: `Congratulations! Your ${typeLabel} "${goalName}" has been completed.`,
        type: "GOAL_COMPLETED",
      };

    case "deadline_approaching":
      return {
        title: `${goalName} deadline in ${metadata.daysRemaining} days`,
        body: `Your ${typeLabel} "${goalName}" is due in ${metadata.daysRemaining} days.`,
        type: "GOAL_DEADLINE_APPROACHING",
      };

    default:
      return {
        title: `Update on ${goalName}`,
        body: `There's an update on your ${typeLabel} "${goalName}".`,
        type: "GOAL_PROGRESS_ALERT",
      };
  }
}

/**
 * Create a reminder for actionable goal notifications
 * Note: The current Reminder model requires a clientId, so for goal-level
 * notifications without clients, we skip reminder creation and rely on
 * in-app notifications + emails instead.
 */
async function createGoalReminder(
  orgId: string,
  goalId: string,
  goalName: string,
  notificationType: GoalNotificationType,
  metadata: NotificationMetadata
): Promise<void> {
  // Goal-level reminders would require extending the Reminder model
  // to support optional clientId. For now, we rely on in-app notifications
  // and email alerts which have already been created.
  console.log(`[Goal Reminder] Would create reminder for goal ${goalId}: ${notificationType}`);

  // Future enhancement: Add optional clientId to Reminder model or create
  // a separate GoalReminder model for goal-specific follow-ups
}

// ============================================
// DEADLINE CHECKING
// ============================================

/**
 * Check for goals with approaching deadlines and send notifications
 * Should be run daily via cron job
 */
export async function checkGoalDeadlines(): Promise<{
  checked: number;
  notified: number;
}> {
  const now = new Date();
  const deadlineIntervals = [30, 14, 7, 1]; // Days before deadline

  let checked = 0;
  let notified = 0;

  for (const days of deadlineIntervals) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);

    // Find goals with deadline on this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const goals = await prisma.goal.findMany({
      where: {
        endDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: [GoalStatus.COMPLETED],
        },
        archivedAt: null,
      },
      select: { id: true },
    });

    checked += goals.length;

    for (const goal of goals) {
      await triggerGoalProgressNotification(goal.id, "deadline_approaching", {
        daysRemaining: days,
      });
      notified++;
    }
  }

  console.log(`Goal deadline check: ${checked} goals checked, ${notified} notifications sent`);

  return { checked, notified };
}

// ============================================
// NOTIFICATION CLEANUP
// ============================================

/**
 * Clean up expired notifications (90+ days old)
 * Should be run daily via cron job
 */
export async function cleanupExpiredNotifications(): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const result = await prisma.notification.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: new Date() } },
        { createdAt: { lte: cutoffDate } },
      ],
    },
  });

  console.log(`Notification cleanup: ${result.count} notifications deleted`);

  return { deleted: result.count };
}

// ============================================
// BULK NOTIFICATION HELPERS
// ============================================

/**
 * Send progress update to all stakeholders of a goal
 */
export async function notifyGoalStakeholders(
  goalId: string,
  message: string,
  actionUrl?: string
): Promise<{ notified: number }> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      owner: { select: { id: true } },
      team: {
        include: {
          members: { select: { userId: true } },
        },
      },
    },
  });

  if (!goal) {
    return { notified: 0 };
  }

  const recipientIds = new Set<string>();

  if (goal.ownerId) {
    recipientIds.add(goal.ownerId);
  }

  if (goal.team) {
    for (const member of goal.team.members) {
      recipientIds.add(member.userId);
    }
  }

  let notified = 0;
  for (const userId of recipientIds) {
    try {
      await createNotification({
        orgId: goal.orgId,
        userId,
        type: "GOAL_PROGRESS_ALERT" as NotificationType,
        title: `Update on ${goal.name}`,
        body: message,
        actionUrl: actionUrl ?? `/goals/${goalId}`,
        metadata: { goalId },
      });
      notified++;
    } catch (error) {
      console.error(`Failed to notify user ${userId}:`, error);
    }
  }

  return { notified };
}
