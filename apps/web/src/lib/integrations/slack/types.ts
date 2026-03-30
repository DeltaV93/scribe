/**
 * Slack-specific types (PX-1005)
 */

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
}

export interface SlackWorkspace {
  id: string;
  name: string;
  url: string;
}

export interface SlackAuthTestResponse {
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  enterprise_id?: string;
  is_enterprise_install?: boolean;
  error?: string;
}

export interface SlackConversationsListResponse {
  ok: boolean;
  channels?: Array<{
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_private: boolean;
    is_member: boolean;
    is_archived: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

export interface SlackPostMessageResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  message?: {
    text: string;
    ts: string;
  };
  error?: string;
}

/**
 * Slack Block Kit types for rich message formatting
 */
export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackContextBlock;

export interface SlackSectionBlock {
  type: "section";
  text: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackAccessory;
}

export interface SlackDividerBlock {
  type: "divider";
}

export interface SlackHeaderBlock {
  type: "header";
  text: SlackTextObject;
}

export interface SlackContextBlock {
  type: "context";
  elements: SlackTextObject[];
}

export interface SlackTextObject {
  type: "mrkdwn" | "plain_text";
  text: string;
  emoji?: boolean;
}

export interface SlackAccessory {
  type: "button";
  text: SlackTextObject;
  url?: string;
  action_id?: string;
}

/**
 * Priority to emoji mapping for action items
 */
export const PRIORITY_EMOJI: Record<string, string> = {
  urgent: ":rotating_light:",
  high: ":red_circle:",
  medium: ":large_yellow_circle:",
  low: ":large_blue_circle:",
};
