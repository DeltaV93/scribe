/**
 * Status mapping utilities for unified action items/tasks view
 *
 * Maps between ReminderStatus, DraftStatus, and ActionItemStatus to provide a unified
 * task interface across calls, meetings, conversations, and reminders.
 */

import { ReminderStatus, DraftStatus } from "@prisma/client";

export type ActionItemStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * Map ReminderStatus to ActionItemStatus
 *
 * Mapping:
 * - PENDING, SENT, OVERDUE → OPEN (tasks that need attention)
 * - ACKNOWLEDGED → IN_PROGRESS (user has seen it, working on it)
 * - COMPLETED → COMPLETED
 * - CANCELLED → CANCELLED
 */
export function reminderToActionItemStatus(
  reminderStatus: ReminderStatus
): ActionItemStatus {
  switch (reminderStatus) {
    case "PENDING":
    case "SENT":
    case "OVERDUE":
      return "OPEN";
    case "ACKNOWLEDGED":
      return "IN_PROGRESS";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "OPEN";
  }
}

/**
 * Map ActionItemStatus back to ReminderStatus for updates
 *
 * When toggling status from the unified view:
 * - OPEN → PENDING (reset to pending state)
 * - IN_PROGRESS → ACKNOWLEDGED
 * - COMPLETED → COMPLETED
 * - CANCELLED → CANCELLED
 */
export function actionItemToReminderStatus(
  actionStatus: ActionItemStatus
): ReminderStatus {
  switch (actionStatus) {
    case "OPEN":
      return "PENDING";
    case "IN_PROGRESS":
      return "ACKNOWLEDGED";
    case "COMPLETED":
      return "COMPLETED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

/**
 * Get reminder statuses that map to a given action item status
 * Used for filtering reminders by action item status
 */
export function actionItemStatusToReminderStatuses(
  actionStatus: ActionItemStatus
): ReminderStatus[] {
  switch (actionStatus) {
    case "OPEN":
      return ["PENDING", "SENT", "OVERDUE"];
    case "IN_PROGRESS":
      return ["ACKNOWLEDGED"];
    case "COMPLETED":
      return ["COMPLETED"];
    case "CANCELLED":
      return ["CANCELLED"];
    default:
      return ["PENDING", "SENT", "OVERDUE"];
  }
}

/**
 * Convert numeric priority to string representation
 * Used for reminders (which use 1-3 numeric) to match action items (which use strings)
 */
export function numericPriorityToString(priority: number | null | undefined): string {
  if (priority === 1) return "HIGH";
  if (priority === 3) return "LOW";
  return "NORMAL";
}

/**
 * Map DraftStatus (from DraftedOutput/Conversations) to ActionItemStatus
 *
 * Mapping:
 * - PENDING, FAILED → OPEN (needs attention)
 * - APPROVED → IN_PROGRESS (approved, awaiting push)
 * - PUSHED → COMPLETED (successfully sent to destination)
 * - REJECTED → CANCELLED
 */
export function draftStatusToActionItemStatus(
  draftStatus: DraftStatus
): ActionItemStatus {
  switch (draftStatus) {
    case "PENDING":
    case "FAILED":
      return "OPEN";
    case "APPROVED":
      return "IN_PROGRESS";
    case "PUSHED":
      return "COMPLETED";
    case "REJECTED":
      return "CANCELLED";
    default:
      return "OPEN";
  }
}

/**
 * Get draft statuses that map to a given action item status
 * Used for filtering conversation action items by action item status
 */
export function actionItemStatusToDraftStatuses(
  actionStatus: ActionItemStatus
): DraftStatus[] {
  switch (actionStatus) {
    case "OPEN":
      return ["PENDING", "FAILED"];
    case "IN_PROGRESS":
      return ["APPROVED"];
    case "COMPLETED":
      return ["PUSHED"];
    case "CANCELLED":
      return ["REJECTED"];
    default:
      return ["PENDING", "FAILED"];
  }
}
