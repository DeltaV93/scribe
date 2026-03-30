/**
 * Integration Output Types (PX-1002)
 *
 * Defines the types of outputs that can be pushed to integrations.
 * Maps output types to compatible platforms.
 */

import { IntegrationPlatform } from "@prisma/client";

// ============================================
// Output Type Enum
// ============================================

export enum OutputType {
  ACTION_ITEM = "ACTION_ITEM",
  MEETING_NOTES = "MEETING_NOTES",
  CASE_NOTE = "CASE_NOTE",
  SESSION_SUMMARY = "SESSION_SUMMARY",
  EMAIL_DRAFT = "EMAIL_DRAFT",
  FOLLOW_UP = "FOLLOW_UP",
  MESSAGE = "MESSAGE",
}

// ============================================
// Platform Compatibility
// ============================================

/**
 * Maps output types to platforms that can receive them.
 *
 * Note: Uses IntegrationPlatform enum values from Prisma.
 */
export const OUTPUT_COMPATIBILITY: Partial<Record<OutputType, IntegrationPlatform[]>> = {
  [OutputType.ACTION_ITEM]: ["LINEAR", "JIRA", "NOTION", "SLACK"],
  [OutputType.MEETING_NOTES]: ["NOTION", "GOOGLE_DOCS", "SLACK"],
  [OutputType.SESSION_SUMMARY]: ["SLACK"],
  [OutputType.MESSAGE]: ["SLACK"],
  // Future platforms:
  // [OutputType.CASE_NOTE]: ["SALESFORCE_NPSP", "APRICOT", "ETO"],
  // [OutputType.EMAIL_DRAFT]: ["GMAIL", "OUTLOOK"],
  // [OutputType.FOLLOW_UP]: ["SLACK", "TEAMS", "EMAIL"],
};

// ============================================
// Output Payloads
// ============================================

/**
 * Base output interface
 */
export interface OutputPayload {
  type: OutputType;
  title: string;
  content: string;
  sourceId?: string; // ID of source conversation/session
  metadata?: Record<string, unknown>;
}

/**
 * Action item to be pushed to task trackers
 */
export interface ActionItemPayload extends OutputPayload {
  type: OutputType.ACTION_ITEM;
  assignee?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate?: Date;
  labels?: string[];
}

/**
 * Meeting notes to be pushed to documentation tools
 */
export interface MeetingNotesPayload extends OutputPayload {
  type: OutputType.MEETING_NOTES;
  participants?: string[];
  date?: Date;
  actionItems?: string[];
  decisions?: string[];
}

/**
 * Case note for case management systems
 */
export interface CaseNotePayload extends OutputPayload {
  type: OutputType.CASE_NOTE;
  clientId?: string;
  caseType?: string;
  serviceDate?: Date;
}

/**
 * Session summary for communication channels
 */
export interface SessionSummaryPayload extends OutputPayload {
  type: OutputType.SESSION_SUMMARY;
  duration?: number; // minutes
  highlights?: string[];
}

/**
 * Message to be posted to communication channels
 */
export interface MessagePayload extends OutputPayload {
  type: OutputType.MESSAGE;
  channelId?: string;
  threadId?: string;
}

// ============================================
// Push Destination
// ============================================

/**
 * Specifies where to push an output
 */
export interface PushDestination {
  platform: IntegrationPlatform;
  workspaceId?: string;
  teamId?: string;
  projectId?: string;
  channelId?: string;
  databaseId?: string;
  folderId?: string;
}

// ============================================
// Helpers
// ============================================

/**
 * Get platforms that can receive a specific output type
 */
export function getPlatformsForOutput(outputType: OutputType): IntegrationPlatform[] {
  return OUTPUT_COMPATIBILITY[outputType] || [];
}

/**
 * Check if a platform can receive a specific output type
 */
export function canPlatformReceiveOutput(
  platform: IntegrationPlatform,
  outputType: OutputType
): boolean {
  const platforms = getPlatformsForOutput(outputType);
  return platforms.includes(platform);
}
