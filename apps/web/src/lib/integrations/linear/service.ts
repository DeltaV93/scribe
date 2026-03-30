/**
 * Linear Workflow Service (PX-882, PX-1007)
 *
 * Implements both WorkflowService and IntegrationAdapter interfaces for Linear integration.
 * Supports pushing action items from conversation outputs to Linear issues.
 */

import { IntegrationPlatform, IntegrationCategory } from "@prisma/client";
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
import type {
  IntegrationAdapter,
  ConnectionTestResult,
  PlatformResources,
  PushOperation,
  PushResult as AdapterPushResult,
  OAuthTokens as AdapterOAuthTokens,
} from "../base/adapter";
import { OutputType, type ActionItemPayload, type OutputPayload } from "../base/output-types";
import {
  linearTokenResponseSchema,
  type LinearTokenResponse,
} from "../base/schemas";
import type { LinearLabel } from "./types";

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

export class LinearWorkflowService implements WorkflowService, IntegrationAdapter {
  // WorkflowService properties
  readonly platform: WorkflowPlatform = "LINEAR";

  // IntegrationAdapter properties
  readonly category: IntegrationCategory = "PROJECT_MGMT";
  readonly displayName: string = "Linear";

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

  // ============================================
  // Resource Discovery (PX-1002)
  // ============================================

  /**
   * Discover teams, projects, and labels available in the Linear workspace
   */
  async discoverResources(accessToken: string): Promise<LinearPlatformResources> {
    const query = `
      query DiscoverResources {
        viewer {
          organization {
            id
            name
            urlKey
          }
        }
        teams {
          nodes {
            id
            name
            key
            projects {
              nodes {
                id
                name
                state
              }
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
          }
        }
        issueLabels {
          nodes {
            id
            name
            color
          }
        }
      }
    `;

    const result = await linearQuery<{
      data?: {
        viewer: {
          organization: {
            id: string;
            name: string;
            urlKey: string;
          };
        };
        teams: {
          nodes: Array<{
            id: string;
            name: string;
            key: string;
            projects: {
              nodes: Array<{
                id: string;
                name: string;
                state: string;
              }>;
            };
            labels: {
              nodes: Array<{
                id: string;
                name: string;
                color: string;
              }>;
            };
          }>;
        };
        issueLabels: {
          nodes: Array<{
            id: string;
            name: string;
            color: string;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    }>(accessToken, query);

    if (result.errors?.length) {
      throw new Error(`Linear discovery failed: ${result.errors[0].message}`);
    }

    const org = result.data?.viewer.organization;
    const teamsData = result.data?.teams.nodes || [];
    const workspaceLabels = result.data?.issueLabels.nodes || [];

    // Collect all labels (workspace-level and team-level)
    const labels: LinearLabel[] = [
      // Workspace-level labels
      ...workspaceLabels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
      // Team-level labels
      ...teamsData.flatMap((team) =>
        team.labels.nodes.map((label) => ({
          id: label.id,
          name: label.name,
          color: label.color,
          teamId: team.id,
        }))
      ),
    ];

    // Deduplicate labels by ID (workspace labels may appear in team queries)
    const uniqueLabels = Array.from(
      new Map(labels.map((l) => [l.id, l])).values()
    );

    const resources: LinearPlatformResources = {
      workspaces: org
        ? [
            {
              id: org.id,
              name: org.name,
              url: `https://linear.app/${org.urlKey}`,
            },
          ]
        : [],
      teams: teamsData.map((team) => ({
        id: team.id,
        name: team.name,
        workspaceId: org?.id,
      })),
      projects: teamsData.flatMap((team) =>
        team.projects.nodes
          .filter((p) => p.state !== "canceled") // Exclude canceled projects
          .map((project) => ({
            id: project.id,
            name: project.name,
            teamId: team.id,
            key: team.key, // Include team key for reference
          }))
      ),
      labels: uniqueLabels,
    };

    return resources;
  }

  // ============================================
  // Unified Push Operation (PX-1007)
  // ============================================

  /**
   * Push an output to Linear using the unified IntegrationAdapter interface.
   * Currently supports ACTION_ITEM output type (creates Linear issues).
   */
  async push(operation: PushOperation): Promise<AdapterPushResult> {
    const { type, payload, destination, accessToken } = operation;

    switch (type) {
      case OutputType.ACTION_ITEM:
        return this.pushActionItemFromPayload(
          accessToken,
          payload as ActionItemPayload,
          destination
        );

      case OutputType.MEETING_NOTES:
        // Linear doesn't have native meeting notes - create as issue with label
        return this.pushMeetingNotesAsIssue(accessToken, payload, destination);

      default:
        return {
          success: false,
          error: `Output type ${type} is not supported by Linear`,
          errorCode: "UNSUPPORTED_TYPE",
        };
    }
  }

  /**
   * Push ACTION_ITEM payload to Linear as an issue
   */
  private async pushActionItemFromPayload(
    accessToken: string,
    payload: ActionItemPayload,
    destination: PushOperation["destination"]
  ): Promise<AdapterPushResult> {
    // Map OutputPayload priority to Linear priority (1-4)
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
    let description = payload.content;
    if (payload.sourceId) {
      description += `\n\n---\n> **Source:** Extracted from conversation \`${payload.sourceId}\``;
    }
    if (payload.metadata?.sourceSnippet) {
      description += `\n\n> "${payload.metadata.sourceSnippet}"`;
    }
    description += `\n\n*Created from conversation by Inkra*`;

    const input: Record<string, unknown> = {
      title: payload.title,
      description,
      priority: priorityMap[payload.priority || "medium"],
    };

    // Use destination for team/project, required for Linear
    if (destination.teamId) {
      input.teamId = destination.teamId;
    } else {
      return {
        success: false,
        error: "Team ID is required for Linear issues",
        errorCode: "MISSING_TEAM",
      };
    }

    if (destination.projectId) {
      input.projectId = destination.projectId;
    }

    // Add due date if provided
    if (payload.dueDate) {
      input.dueDate = payload.dueDate.toISOString().split("T")[0];
    }

    // Add labels if provided
    if (payload.labels?.length) {
      input.labelIds = payload.labels;
    }

    try {
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

  /**
   * Push meeting notes as a Linear issue with "meeting-notes" label
   */
  private async pushMeetingNotesAsIssue(
    accessToken: string,
    payload: OutputPayload,
    destination: PushOperation["destination"]
  ): Promise<AdapterPushResult> {
    // Create as ACTION_ITEM with meeting-notes context
    const actionPayload: ActionItemPayload = {
      type: OutputType.ACTION_ITEM,
      title: `Meeting Notes: ${payload.title}`,
      content: payload.content,
      priority: "low",
      labels: ["meeting-notes"],
      sourceId: payload.sourceId,
      metadata: payload.metadata,
    };

    return this.pushActionItemFromPayload(accessToken, actionPayload, destination);
  }
}

// ============================================
// Extended Platform Resources for Linear
// ============================================

/**
 * Linear-specific platform resources including labels
 */
export interface LinearPlatformResources extends PlatformResources {
  labels?: LinearLabel[];
}

// Export singleton for backward compatibility
export const linearWorkflowService = new LinearWorkflowService();
