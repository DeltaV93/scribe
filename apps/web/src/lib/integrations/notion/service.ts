/**
 * Notion Workflow Service (PX-882)
 *
 * Implements WorkflowService interface for Notion integration.
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
  notionTokenResponseSchema,
  type NotionTokenResponse,
} from "../base/schemas";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

/**
 * Make authenticated request to Notion API
 */
async function notionRequest<T>(
  accessToken: string,
  endpoint: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${NOTION_API_BASE}${endpoint}`, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string }).message ||
        `Notion API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Convert markdown to Notion blocks
 */
function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: line.slice(4) } }],
        },
      });
    } else if (line.startsWith("## ")) {
      blocks.push({
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: line.slice(3) } }],
        },
      });
    } else if (line.startsWith("# ")) {
      blocks.push({
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      });
    }
    // Bullet points
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      });
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [
            { type: "text", text: { content: line.replace(/^\d+\.\s/, "") } },
          ],
        },
      });
    }
    // Checkboxes
    else if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) {
      blocks.push({
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: line.slice(6) } }],
          checked: line.startsWith("- [x] "),
        },
      });
    }
    // Blockquotes
    else if (line.startsWith("> ")) {
      blocks.push({
        type: "quote",
        quote: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }],
        },
      });
    }
    // Code blocks
    else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code",
        code: {
          rich_text: [{ type: "text", text: { content: codeLines.join("\n") } }],
          language: "plain text",
        },
      });
    }
    // Regular paragraphs
    else {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: line } }],
        },
      });
    }

    i++;
  }

  return blocks;
}

export class NotionWorkflowService implements WorkflowService {
  readonly platform: WorkflowPlatform = "NOTION";

  isConfigured(): boolean {
    return !!(
      process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
    );
  }

  getOAuthConfig(): OAuthConfig | null {
    if (!this.isConfigured()) return null;

    return {
      authUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      clientId: process.env.NOTION_CLIENT_ID!,
      clientSecret: process.env.NOTION_CLIENT_SECRET!,
    };
  }

  getAuthorizationUrl(state: string, callbackUrl: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Notion is not configured");
    }

    const url = new URL(config.authUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("state", state);

    return url.toString();
  }

  async exchangeCodeForTokens(
    code: string,
    callbackUrl: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw new Error("Notion is not configured");
    }

    // Notion uses Basic auth for token exchange
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();
    const parsed = notionTokenResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid token response: ${parsed.error.message}`);
    }

    const tokens = parsed.data as NotionTokenResponse;

    // Notion tokens don't expire
    return {
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
    };
  }

  async testConnection(accessToken: string): Promise<ConnectionStatus> {
    try {
      const result = await notionRequest<{
        bot: {
          owner: {
            type: string;
            workspace?: {
              id: string;
              name: string;
            };
          };
        };
      }>(accessToken, "/users/me", "GET");

      return {
        success: true,
        details: {
          workspaceName: result.bot?.owner?.workspace?.name,
          workspaceId: result.bot?.owner?.workspace?.id,
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
      // Create as a to-do item in a database or as a page
      const children: NotionBlock[] = [
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: draft.description } }],
          },
        },
      ];

      if (draft.sourceSnippet) {
        children.push(
          { type: "divider", divider: {} },
          {
            type: "quote",
            quote: {
              rich_text: [
                { type: "text", text: { content: draft.sourceSnippet } },
              ],
            },
          }
        );
      }

      children.push(
        { type: "divider", divider: {} },
        {
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: "Created from conversation by Inkra" },
                annotations: { italic: true, color: "gray" },
              },
            ],
          },
        }
      );

      const pageBody: Record<string, unknown> = {
        properties: {
          title: {
            title: [{ type: "text", text: { content: draft.title } }],
          },
        },
        children,
      };

      // Set parent
      if (config?.defaultDatabaseId) {
        pageBody.parent = { database_id: config.defaultDatabaseId };
      } else if (config?.defaultPageId) {
        pageBody.parent = { page_id: config.defaultPageId };
      } else {
        return {
          success: false,
          error: "No database or parent page configured",
          errorCode: "NO_PARENT",
        };
      }

      const result = await notionRequest<{ id: string; url: string }>(
        accessToken,
        "/pages",
        "POST",
        pageBody
      );

      return {
        success: true,
        externalId: result.id,
        externalUrl: result.url,
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
      const children: NotionBlock[] = [];

      // Add attendees
      if (draft.attendees?.length) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: "Attendees: " },
                annotations: { bold: true },
              },
              { type: "text", text: { content: draft.attendees.join(", ") } },
            ],
          },
        });
        children.push({ type: "divider", divider: {} });
      }

      // Add sections
      if (draft.sections?.length) {
        for (const section of draft.sections) {
          children.push({
            type: "heading_2",
            heading_2: {
              rich_text: [{ type: "text", text: { content: section.heading } }],
            },
          });
          children.push(...markdownToNotionBlocks(section.content));
        }
      } else {
        // Just add the content as markdown
        children.push(...markdownToNotionBlocks(draft.content));
      }

      // Add action items
      if (draft.actionItems?.length) {
        children.push({
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Action Items" } }],
          },
        });
        for (const item of draft.actionItems) {
          children.push({
            type: "to_do",
            to_do: {
              rich_text: [{ type: "text", text: { content: item } }],
              checked: false,
            },
          });
        }
      }

      // Add footer
      children.push({ type: "divider", divider: {} });
      children.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "Created from conversation by Inkra" },
              annotations: { italic: true, color: "gray" },
            },
          ],
        },
      });

      const pageBody: Record<string, unknown> = {
        properties: {
          title: {
            title: [{ type: "text", text: { content: draft.title } }],
          },
        },
        children,
      };

      // Set parent
      if (config?.defaultDatabaseId || draft.databaseId) {
        pageBody.parent = {
          database_id: config?.defaultDatabaseId || draft.databaseId,
        };
      } else if (config?.defaultPageId || draft.parentPageId) {
        pageBody.parent = {
          page_id: config?.defaultPageId || draft.parentPageId,
        };
      } else {
        return {
          success: false,
          error: "No database or parent page configured",
          errorCode: "NO_PARENT",
        };
      }

      const result = await notionRequest<{ id: string; url: string }>(
        accessToken,
        "/pages",
        "POST",
        pageBody
      );

      return {
        success: true,
        externalId: result.id,
        externalUrl: result.url,
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
  // Resource Discovery (PX-1002)
  // ============================================

  /**
   * Discover databases and pages available in the Notion workspace
   */
  async discoverResources(accessToken: string): Promise<PlatformResources> {
    // Get workspace info
    const userInfo = await notionRequest<{
      bot: {
        owner: {
          type: string;
          workspace?: {
            id: string;
            name: string;
          };
        };
      };
    }>(accessToken, "/users/me", "GET");

    const workspace = userInfo.bot?.owner?.workspace;

    // Search for databases the integration has access to
    const searchResult = await notionRequest<{
      results: Array<{
        object: "database" | "page";
        id: string;
        title?: Array<{ plain_text: string }>;
        parent?: {
          type: string;
          page_id?: string;
          database_id?: string;
          workspace?: boolean;
        };
        url?: string;
      }>;
      has_more: boolean;
      next_cursor: string | null;
    }>(accessToken, "/search", "POST", {
      filter: {
        property: "object",
        value: "database",
      },
      page_size: 100,
    });

    const databases = searchResult.results
      .filter((item) => item.object === "database")
      .map((db) => ({
        id: db.id,
        name: db.title?.[0]?.plain_text || "Untitled Database",
        parentId: db.parent?.page_id || db.parent?.database_id,
      }));

    // Also search for top-level pages that can be parents
    const pagesResult = await notionRequest<{
      results: Array<{
        object: "page";
        id: string;
        properties?: {
          title?: {
            title?: Array<{ plain_text: string }>;
          };
        };
        parent?: {
          type: string;
          workspace?: boolean;
        };
        url?: string;
      }>;
    }>(accessToken, "/search", "POST", {
      filter: {
        property: "object",
        value: "page",
      },
      page_size: 50,
    });

    // Filter to top-level pages (workspace parent)
    const topLevelPages = pagesResult.results
      .filter((page) => page.parent?.workspace)
      .map((page) => ({
        id: page.id,
        name:
          page.properties?.title?.title?.[0]?.plain_text || "Untitled Page",
      }));

    const resources: PlatformResources = {
      workspaces: workspace
        ? [
            {
              id: workspace.id,
              name: workspace.name,
            },
          ]
        : [],
      databases,
      // Use folders to represent top-level pages that can be parents
      folders: topLevelPages,
    };

    return resources;
  }
}

// Export singleton for backward compatibility
export const notionWorkflowService = new NotionWorkflowService();
