/**
 * Quick Action Types
 *
 * Types for the floating action button and quick actions sheet.
 */

import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Permission check: [resource, action] */
  permission?: [string, string];
}

export type QuickActionId = "create-conversation" | "call-client";

export interface QuickActionAnalyticsEvent {
  action: QuickActionId;
  source: "click" | "keyboard";
}
