/**
 * Quick Action Analytics
 *
 * Event tracking for quick action FAB usage.
 */

import type { QuickActionId } from "./types";

export const QuickActionEvents = {
  FAB_CLICKED: "quick_action.fab_clicked",
  SHEET_OPENED_KEYBOARD: "quick_action.sheet_opened_keyboard",
  SHEET_CLOSED: "quick_action.sheet_closed",
  ACTION_SELECTED: "quick_action.action_selected",
  FAB_VISIBILITY_CHANGED: "quick_action.fab_visibility_changed",
} as const;

interface ActionSelectedPayload {
  action: QuickActionId;
  source: "click" | "keyboard";
}

interface FabVisibilityPayload {
  visible: boolean;
}

/**
 * Track quick action events.
 *
 * Note: This is a stub that logs to console in development.
 * Replace with your actual analytics implementation.
 */
export function trackQuickActionEvent(
  event: keyof typeof QuickActionEvents,
  payload?: ActionSelectedPayload | FabVisibilityPayload
): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[QuickAction Analytics]", QuickActionEvents[event], payload);
  }

  // TODO: Integrate with your analytics provider
  // Example:
  // analytics.track(QuickActionEvents[event], payload);
}
