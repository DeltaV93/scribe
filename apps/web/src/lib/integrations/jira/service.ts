/**
 * Jira Workflow Service (PX-882)
 *
 * Implements WorkflowService interface for Jira integration.
 * Uses Atlassian OAuth 2.0 (3LO) and Jira REST API v3.
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
import type { PlatformResources } from "../base/adapter";
import {
  jiraTokenResponseSchema,
  jiraAccessibleResourcesSchema,
  type JiraTokenResponse,
  type JiraAccessibleResources,
} from "../base/schemas";

const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com";
const ATLASSIAN_API_URL = "https://api.atlassian.com";

/**
 * Make authenticated request to Jira API
 */
async function jiraRequest<T>(
  accessToken: string,
  cloudId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${ATLASSIAN_API_URL}/ex/jira/${cloudId}/rest/api/3${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { errorMessages?: string[] }).errorMessages?.[0] ||
        (error as { message?: string }).message ||
        `Jira API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get accessible Jira cloud resources for the token
 */
async function getAccessibleResources(
  accessToken: string
): Promise<JiraAccessibleResources> {
  const response = await fetch(
    `${ATLASSIAN_API_URL}/oauth/token/accessible-resources`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get accessible resources: ${response.status}`);
  }

  const data = await response.json();
  const parsed = jiraAccessibleResourcesSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(`Invalid resources response: ${parsed.error.message}`);
  }

  return parsed.data;
}

export class JiraWorkflowService implements WorkflowService {
  readonly platform: WorkflowPlatform = "JIRA";

  isConfigured(): boolean {
    return !!(process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET);
  }

  getOAuthConfig(): OAuthConfig | null {
    if (!this.isConfigured()) return null;

    return {
      authUrl: `${ATLASSIAN_AUTH_URL}/authorize`,
      tokenUrl: `${ATLASSIAN_AUTH_URL}/oauth/token`,
      scopes: [
        "read:jira-work",
        "write:jira-work",
        "read:jira-user",
        "offline_access",
      ],
      clientId: process.env.JIRA_CLIENT_ID!,
      clientSecret: process.env.JIRA_CLIENT_SECRET!,
    };
  }

  getAuthorizationUrl(state: string, callbackUrl: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Jira is not configured");
    }

    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("prompt", "consent");
    if (config.scopes?.length) {
      url.searchParams.set("scope", config.scopes.join(" "));
    }

    return url.toString();
  }

  async exchangeCodeForTokens(
    code: string,
    callbackUrl: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Jira is not configured");
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
    const parsed = jiraTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid token response: ${parsed.error.message}`);
    }

    const tokens = parsed.data as JiraTokenResponse;

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scope: tokens.scope,
    };
  }

  async testConnection(accessToken: string): Promise<ConnectionStatus> {
    try {
      // Get accessible resources (Jira sites)
      const resources = await getAccessibleResources(accessToken);

      if (resources.length === 0) {
        return {
          success: false,
          error: "No Jira sites accessible with this token",
        };
      }

      // Use first available site
      const site = resources[0];

      // Get current user
      const user = await jiraRequest<{
        accountId: string;
        displayName: string;
        emailAddress?: string;
      }>(accessToken, site.id, "/myself");

      return {
        success: true,
        details: {
          workspaceName: site.name,
          workspaceId: site.id,
          userName: user.displayName,
          userId: user.accountId,
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
      const cloudId = config?.cloudId;
      if (!cloudId) {
        // Try to get from accessible resources
        const resources = await getAccessibleResources(accessToken);
        if (resources.length === 0) {
          return {
            success: false,
            error: "No Jira sites accessible",
            errorCode: "NO_SITES",
          };
        }
        return this.createIssue(accessToken, resources[0].id, draft, config);
      }

      return this.createIssue(accessToken, cloudId, draft, config);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "EXCEPTION",
      };
    }
  }

  private async createIssue(
    accessToken: string,
    cloudId: string,
    draft: ActionItemDraft,
    config?: PlatformConfig
  ): Promise<PushResult> {
    // Build Atlassian Document Format (ADF) description
    const descriptionAdf = this.buildAdfDescription(draft);

    const issueData: Record<string, unknown> = {
      fields: {
        summary: draft.title,
        description: descriptionAdf,
        issuetype: {
          name: config?.defaultIssueType || "Task",
        },
      },
    };

    // Add project
    if (config?.projectKey) {
      (issueData.fields as Record<string, unknown>).project = {
        key: config.projectKey,
      };
    } else {
      // Get first available project
      const projects = await jiraRequest<{
        values: Array<{ key: string; name: string }>;
      }>(accessToken, cloudId, "/project/search?maxResults=1");

      if (projects.values.length === 0) {
        return {
          success: false,
          error: "No projects available",
          errorCode: "NO_PROJECTS",
        };
      }

      (issueData.fields as Record<string, unknown>).project = {
        key: projects.values[0].key,
      };
    }

    // Add priority if supported
    if (draft.priority) {
      const priorityMap: Record<string, string> = {
        urgent: "Highest",
        high: "High",
        medium: "Medium",
        low: "Low",
      };
      (issueData.fields as Record<string, unknown>).priority = {
        name: priorityMap[draft.priority] || "Medium",
      };
    }

    // Add due date
    if (draft.dueDate) {
      (issueData.fields as Record<string, unknown>).duedate = draft.dueDate;
    }

    const result = await jiraRequest<{
      id: string;
      key: string;
      self: string;
    }>(accessToken, cloudId, "/issue", "POST", issueData);

    // Build issue URL
    const resources = await getAccessibleResources(accessToken);
    const site = resources.find((r) => r.id === cloudId);
    const issueUrl = site
      ? `${site.url}/browse/${result.key}`
      : `https://jira.atlassian.com/browse/${result.key}`;

    return {
      success: true,
      externalId: result.id,
      externalUrl: issueUrl,
    };
  }

  /**
   * Build Atlassian Document Format (ADF) description
   */
  private buildAdfDescription(draft: ActionItemDraft): Record<string, unknown> {
    const content: unknown[] = [
      {
        type: "paragraph",
        content: [{ type: "text", text: draft.description }],
      },
    ];

    if (draft.sourceSnippet) {
      content.push(
        { type: "rule" },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Source: ", marks: [{ type: "strong" }] },
                { type: "text", text: `"${draft.sourceSnippet}"` },
              ],
            },
          ],
        }
      );
    }

    content.push(
      { type: "rule" },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Created from conversation by Inkra",
            marks: [{ type: "em" }],
          },
        ],
      }
    );

    return {
      type: "doc",
      version: 1,
      content,
    };
  }

  async pushMeetingNotes(
    accessToken: string,
    draft: MeetingNotesDraft,
    config?: PlatformConfig
  ): Promise<PushResult> {
    // Jira doesn't have native meeting notes
    // Create as an issue with "Meeting Notes" type or label
    const actionItem: ActionItemDraft = {
      title: `Meeting Notes: ${draft.title}`,
      description: draft.content,
      priority: "low",
    };

    return this.pushActionItem(accessToken, actionItem, config);
  }

  // ============================================
  // Resource Discovery (PX-1002)
  // ============================================

  /**
   * Discover Jira sites and projects available with the access token
   */
  async discoverResources(accessToken: string): Promise<PlatformResources> {
    // Get accessible Jira cloud sites
    const sites = await getAccessibleResources(accessToken);

    const resources: PlatformResources = {
      workspaces: sites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.url,
      })),
      projects: [],
    };

    // For each site, get projects
    for (const site of sites) {
      try {
        const projectsResult = await jiraRequest<{
          values: Array<{
            id: string;
            key: string;
            name: string;
            projectTypeKey: string;
          }>;
          maxResults: number;
          total: number;
        }>(accessToken, site.id, "/project/search?maxResults=100");

        const siteProjects = projectsResult.values.map((project) => ({
          id: project.id,
          name: project.name,
          key: project.key,
          teamId: site.id, // Use site as team equivalent
        }));

        resources.projects = [...(resources.projects || []), ...siteProjects];
      } catch (error) {
        console.warn(
          `[Jira Discovery] Failed to get projects for site ${site.id}:`,
          error
        );
      }
    }

    return resources;
  }
}

// Export singleton for backward compatibility
export const jiraWorkflowService = new JiraWorkflowService();
