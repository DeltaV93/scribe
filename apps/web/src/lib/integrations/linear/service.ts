/**
 * Linear Workflow Service (PX-882)
 *
 * Implements WorkflowService interface for Linear integration.
 */

import type {
  WorkflowService,
  WorkflowPlatform,
  OAuthConfig,
  OAuthTokens,
  ConnectionStatus,
  PushResult,
  ActionItemDraft,
  MeetingNotesDraft,
  PlatformConfig,
} from "../base/types";
import {
  linearTokenResponseSchema,
  type LinearTokenResponse,
} from "../base/schemas";

const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Execute GraphQL query against Linear API
 */
async function linearQuery<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status}`);
  }

  return response.json();
}

export class LinearWorkflowService implements WorkflowService {
  readonly platform: WorkflowPlatform = "LINEAR";

  isConfigured(): boolean {
    return !!(
      process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET
    );
  }

  getOAuthConfig(): OAuthConfig | null {
    if (!this.isConfigured()) return null;

    return {
      authUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      scopes: ["read", "write", "issues:create"],
      clientId: process.env.LINEAR_CLIENT_ID!,
      clientSecret: process.env.LINEAR_CLIENT_SECRET!,
    };
  }

  getAuthorizationUrl(state: string, callbackUrl: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Linear is not configured");
    }

    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
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
      throw new Error("Linear is not configured");
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();
    const parsed = linearTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid token response: ${parsed.error.message}`);
    }

    const tokens = parsed.data as LinearTokenResponse;

    return {
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scope: tokens.scope,
    };
  }

  async testConnection(accessToken: string): Promise<ConnectionStatus> {
    try {
      const query = `
        query Viewer {
          viewer {
            id
            name
            organization {
              id
              name
            }
          }
        }
      `;

      const result = await linearQuery<{
        data?: {
          viewer: {
            id: string;
            name: string;
            organization: { id: string; name: string };
          };
        };
        errors?: Array<{ message: string }>;
      }>(accessToken, query);

      if (result.errors?.length) {
        return { success: false, error: result.errors[0].message };
      }

      return {
        success: true,
        details: {
          workspaceName: result.data?.viewer.organization.name,
          workspaceId: result.data?.viewer.organization.id,
          userName: result.data?.viewer.name,
          userId: result.data?.viewer.id,
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
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };

      const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
              url
            }
          }
        }
      `;

      // Build description with source snippet
      let description = draft.description;
      if (draft.sourceSnippet) {
        description += `\n\n---\n> **Source:** "${draft.sourceSnippet}"`;
      }
      description += `\n\n*Created from conversation recording by Inkra*`;

      const input: Record<string, unknown> = {
        title: draft.title,
        description,
        priority: priorityMap[draft.priority || "medium"],
      };

      // Add optional fields
      if (config?.teamId || draft.teamId) {
        input.teamId = config?.teamId || draft.teamId;
      }
      if (config?.defaultProjectId || draft.projectId) {
        input.projectId = config?.defaultProjectId || draft.projectId;
      }
      if (draft.dueDate) {
        input.dueDate = draft.dueDate;
      }
      if (draft.labels?.length) {
        input.labelIds = draft.labels;
      }

      const result = await linearQuery<{
        data?: {
          issueCreate: {
            success: boolean;
            issue?: {
              id: string;
              identifier: string;
              title: string;
              url: string;
            };
          };
        };
        errors?: Array<{ message: string }>;
      }>(accessToken, mutation, { input });

      if (result.errors?.length) {
        return {
          success: false,
          error: result.errors[0].message,
          errorCode: "LINEAR_API_ERROR",
        };
      }

      if (!result.data?.issueCreate.success || !result.data.issueCreate.issue) {
        return {
          success: false,
          error: "Failed to create Linear issue",
          errorCode: "CREATE_FAILED",
        };
      }

      return {
        success: true,
        externalId: result.data.issueCreate.issue.id,
        externalUrl: result.data.issueCreate.issue.url,
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
    // Linear doesn't have a native meeting notes feature
    // Create as a project update or document
    try {
      // For now, create as an issue with "Notes" label
      const actionItem: ActionItemDraft = {
        title: `Meeting Notes: ${draft.title}`,
        description: draft.content,
        priority: "low",
        labels: ["meeting-notes"],
        teamId: config?.teamId,
        projectId: config?.defaultProjectId,
      };

      return this.pushActionItem(accessToken, actionItem, config);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "EXCEPTION",
      };
    }
  }
}

// Export singleton for backward compatibility
export const linearWorkflowService = new LinearWorkflowService();
