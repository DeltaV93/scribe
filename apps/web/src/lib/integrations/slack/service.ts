/**
 * Slack Workflow Service (PX-1005)
 *
 * Implements WorkflowService interface for Slack integration.
 * Posts messages to Slack channels using Block Kit for formatting.
 */

import type {
  WorkflowService,
  OAuthConfig,
  OAuthTokens,
  ConnectionStatus,
  PushResult,
  ActionItemDraft,
  MeetingNotesDraft,
  PlatformConfig,
} from "../base/types";
import type { PlatformResources } from "../base/adapter";
import type {
  SlackAuthTestResponse,
  SlackConversationsListResponse,
  SlackPostMessageResponse,
  SlackBlock,
  SlackTextObject,
} from "./types";
import { PRIORITY_EMOJI } from "./types";
import {
  slackTokenResponseSchema,
  type SlackTokenResponse,
} from "../base/schemas";

const SLACK_API_BASE = "https://slack.com/api";

/**
 * Make authenticated request to Slack API
 */
async function slackRequest<T>(
  accessToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${SLACK_API_BASE}/${method}`, options);

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Build Block Kit blocks for an action item
 */
function buildActionItemBlocks(draft: ActionItemDraft): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header with priority emoji
  const priorityEmoji = draft.priority ? PRIORITY_EMOJI[draft.priority] || "" : "";
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `${priorityEmoji} ${draft.title}`.trim(),
      emoji: true,
    },
  });

  // Description
  if (draft.description) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: draft.description,
      },
    });
  }

  // Metadata fields
  const fields: SlackTextObject[] = [];

  if (draft.assignee) {
    fields.push({
      type: "mrkdwn",
      text: `*Assignee:* ${draft.assignee}`,
    });
  }

  if (draft.dueDate) {
    fields.push({
      type: "mrkdwn",
      text: `*Due:* ${draft.dueDate}`,
    });
  }

  if (draft.priority) {
    fields.push({
      type: "mrkdwn",
      text: `*Priority:* ${draft.priority.charAt(0).toUpperCase() + draft.priority.slice(1)}`,
    });
  }

  if (draft.labels?.length) {
    fields.push({
      type: "mrkdwn",
      text: `*Labels:* ${draft.labels.join(", ")}`,
    });
  }

  if (fields.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: " ", // Required but we're using fields
      },
      fields,
    });
  }

  // Source snippet if available
  if (draft.sourceSnippet) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `> _"${draft.sourceSnippet}"_`,
        },
      ],
    });
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "_Created from conversation recording by Inkra_",
      },
    ],
  });

  return blocks;
}

/**
 * Build Block Kit blocks for a session summary / meeting notes
 */
function buildSessionSummaryBlocks(draft: MeetingNotesDraft): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: draft.title,
      emoji: true,
    },
  });

  // Attendees
  if (draft.attendees?.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Participants:* ${draft.attendees.join(", ")}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Sections
  if (draft.sections?.length) {
    for (const section of draft.sections) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${section.heading}*\n${section.content}`,
        },
      });
    }
  } else if (draft.content) {
    // Just add the content
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: draft.content,
      },
    });
  }

  // Action items
  if (draft.actionItems?.length) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Items:*\n${draft.actionItems.map((item) => `- [ ] ${item}`).join("\n")}`,
      },
    });
  }

  // Footer
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "_Created from conversation recording by Inkra_",
      },
    ],
  });

  return blocks;
}

// Extend WorkflowPlatform to include SLACK for this service
type SlackPlatform = "SLACK";

export class SlackWorkflowService implements WorkflowService {
  readonly platform: SlackPlatform = "SLACK";

  isConfigured(): boolean {
    return !!(
      process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
    );
  }

  getOAuthConfig(): OAuthConfig | null {
    if (!this.isConfigured()) return null;

    return {
      authUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: ["chat:write", "channels:read", "groups:read", "users:read"],
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
    };
  }

  getAuthorizationUrl(state: string, callbackUrl: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Slack is not configured");
    }

    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("state", state);
    if (config.scopes?.length) {
      url.searchParams.set("scope", config.scopes.join(","));
    }

    return url.toString();
  }

  async exchangeCodeForTokens(
    code: string,
    callbackUrl: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Slack is not configured");
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();

    // Slack returns ok: false for errors even with 200 status
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    const parsed = slackTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid token response: ${parsed.error.message}`);
    }

    const tokens = parsed.data as SlackTokenResponse;

    // Slack bot tokens don't expire
    return {
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
    };
  }

  async testConnection(accessToken: string): Promise<ConnectionStatus> {
    try {
      const result = await slackRequest<SlackAuthTestResponse>(
        accessToken,
        "auth.test"
      );

      if (!result.ok) {
        return { success: false, error: result.error || "Auth test failed" };
      }

      return {
        success: true,
        details: {
          workspaceName: result.team,
          workspaceId: result.team_id,
          userName: result.user,
          userId: result.user_id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async pushActionItem(
    accessToken: string,
    draft: ActionItemDraft,
    config?: PlatformConfig
  ): Promise<PushResult> {
    try {
      const channelId = config?.channelId;
      if (!channelId) {
        return {
          success: false,
          error: "No channel configured for Slack",
          errorCode: "NO_CHANNEL",
        };
      }

      const blocks = buildActionItemBlocks(draft);

      const result = await slackRequest<SlackPostMessageResponse>(
        accessToken,
        "chat.postMessage",
        {
          channel: channelId,
          text: `Action Item: ${draft.title}`, // Fallback for notifications
          blocks,
        }
      );

      if (!result.ok) {
        return {
          success: false,
          error: result.error || "Failed to post message",
          errorCode: "SLACK_API_ERROR",
        };
      }

      return {
        success: true,
        externalId: result.ts,
        // Slack doesn't return a direct URL, would need to construct it
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "EXCEPTION",
      };
    }
  }

  async pushMeetingNotes(
    accessToken: string,
    draft: MeetingNotesDraft,
    config?: PlatformConfig
  ): Promise<PushResult> {
    try {
      const channelId = config?.channelId;
      if (!channelId) {
        return {
          success: false,
          error: "No channel configured for Slack",
          errorCode: "NO_CHANNEL",
        };
      }

      const blocks = buildSessionSummaryBlocks(draft);

      const result = await slackRequest<SlackPostMessageResponse>(
        accessToken,
        "chat.postMessage",
        {
          channel: channelId,
          text: `Session Summary: ${draft.title}`, // Fallback for notifications
          blocks,
        }
      );

      if (!result.ok) {
        return {
          success: false,
          error: result.error || "Failed to post message",
          errorCode: "SLACK_API_ERROR",
        };
      }

      return {
        success: true,
        externalId: result.ts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "EXCEPTION",
      };
    }
  }

  // ============================================
  // Resource Discovery (PX-1005)
  // ============================================

  /**
   * Discover channels available in the Slack workspace
   */
  async discoverResources(accessToken: string): Promise<PlatformResources> {
    // Get workspace info
    const authResult = await slackRequest<SlackAuthTestResponse>(
      accessToken,
      "auth.test"
    );

    if (!authResult.ok) {
      throw new Error(`Slack auth failed: ${authResult.error}`);
    }

    // Get public channels
    const publicChannels = await this.fetchAllChannels(
      accessToken,
      "public_channel"
    );

    // Get private channels the bot is a member of
    const privateChannels = await this.fetchAllChannels(
      accessToken,
      "private_channel"
    );

    const allChannels = [...publicChannels, ...privateChannels];

    const resources: PlatformResources = {
      workspaces: authResult.team
        ? [
            {
              id: authResult.team_id || "",
              name: authResult.team,
              url: authResult.url,
            },
          ]
        : [],
      channels: allChannels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
      })),
    };

    return resources;
  }

  /**
   * Fetch all channels of a given type with pagination
   */
  private async fetchAllChannels(
    accessToken: string,
    type: "public_channel" | "private_channel"
  ): Promise<
    Array<{
      id: string;
      name: string;
      is_private: boolean;
      is_member: boolean;
    }>
  > {
    const channels: Array<{
      id: string;
      name: string;
      is_private: boolean;
      is_member: boolean;
    }> = [];

    let cursor: string | undefined;

    do {
      const params: Record<string, unknown> = {
        types: type,
        limit: 200,
        exclude_archived: true,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const result = await slackRequest<SlackConversationsListResponse>(
        accessToken,
        "conversations.list",
        params
      );

      if (!result.ok) {
        throw new Error(`Failed to list channels: ${result.error}`);
      }

      if (result.channels) {
        for (const ch of result.channels) {
          if (!ch.is_archived) {
            channels.push({
              id: ch.id,
              name: ch.name,
              is_private: ch.is_private,
              is_member: ch.is_member,
            });
          }
        }
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }
}

// Export singleton for backward compatibility
export const slackWorkflowService = new SlackWorkflowService();
