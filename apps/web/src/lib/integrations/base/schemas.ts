/**
 * Workflow Integrations - Zod Validation Schemas (PX-882)
 *
 * Validates all OAuth responses and input data to prevent
 * injection attacks and ensure data integrity.
 */

import { z } from "zod";

// ============================================
// OAuth State Schema
// ============================================

export const oauthStateSchema = z.object({
  platform: z.enum(["LINEAR", "NOTION", "JIRA", "SLACK"]),
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  redirectUrl: z.string().optional(),
  createdAt: z.number(),
});

export type OAuthStateData = z.infer<typeof oauthStateSchema>;

// ============================================
// Platform Token Response Schemas
// ============================================

/**
 * Linear OAuth token response
 */
export const linearTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});

export type LinearTokenResponse = z.infer<typeof linearTokenResponseSchema>;

/**
 * Notion OAuth token response
 * Notion includes workspace info in token response
 */
export const notionTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("bearer").optional(),
  bot_id: z.string().optional(),
  workspace_id: z.string().optional(),
  workspace_name: z.string().optional(),
  workspace_icon: z.string().nullable().optional(),
  owner: z
    .object({
      type: z.string(),
      user: z
        .object({
          id: z.string(),
          name: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type NotionTokenResponse = z.infer<typeof notionTokenResponseSchema>;

/**
 * Jira OAuth token response
 */
export const jiraTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type JiraTokenResponse = z.infer<typeof jiraTokenResponseSchema>;

/**
 * Jira accessible resources response
 */
export const jiraAccessibleResourcesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    scopes: z.array(z.string()),
    avatarUrl: z.string().optional(),
  })
);

export type JiraAccessibleResources = z.infer<
  typeof jiraAccessibleResourcesSchema
>;

/**
 * Slack OAuth token response
 * Slack returns authed_user info alongside bot token
 */
export const slackTokenResponseSchema = z.object({
  ok: z.literal(true),
  access_token: z.string().min(1),
  token_type: z.literal("bot").optional(),
  scope: z.string().optional(),
  bot_user_id: z.string().optional(),
  app_id: z.string().optional(),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  authed_user: z
    .object({
      id: z.string(),
      scope: z.string().optional(),
      access_token: z.string().optional(),
      token_type: z.string().optional(),
    })
    .optional(),
  enterprise: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  is_enterprise_install: z.boolean().optional(),
});

export type SlackTokenResponse = z.infer<typeof slackTokenResponseSchema>;

// ============================================
// Connection Status Schemas
// ============================================

export const connectionStatusSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  details: z
    .object({
      workspaceName: z.string().optional(),
      workspaceId: z.string().optional(),
      userName: z.string().optional(),
      userId: z.string().optional(),
    })
    .optional(),
});

// ============================================
// Push Operation Schemas
// ============================================

export const actionItemDraftSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  labels: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  sourceSnippet: z.string().max(2000).optional(),
});

export const meetingNotesDraftSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(100000),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  attendees: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  databaseId: z.string().optional(),
  parentPageId: z.string().optional(),
});

// ============================================
// API Request Schemas
// ============================================

export const pushOutputRequestSchema = z.object({
  platform: z.enum(["LINEAR", "NOTION", "JIRA", "SLACK"]),
  outputType: z.enum(["ACTION_ITEM", "MEETING_NOTES", "SESSION_SUMMARY"]),
  config: z
    .object({
      teamId: z.string().optional(),
      projectId: z.string().optional(),
      databaseId: z.string().optional(),
      parentPageId: z.string().optional(),
      issueType: z.string().optional(),
      channelId: z.string().optional(), // Slack channel
    })
    .optional(),
});

// ============================================
// Error Response Schema
// ============================================

export const oauthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate and parse token response for a platform
 */
export function validateTokenResponse(
  platform: "LINEAR" | "NOTION" | "JIRA" | "SLACK",
  data: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const schemas = {
    LINEAR: linearTokenResponseSchema,
    NOTION: notionTokenResponseSchema,
    JIRA: jiraTokenResponseSchema,
    SLACK: slackTokenResponseSchema,
  };

  const schema = schemas[platform];
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: `Invalid ${platform} token response: ${result.error.message}`,
    };
  }

  return { success: true, data: result.data };
}
