/**
 * Notion Integration Adapter (PX-1006)
 *
 * Implements the full IntegrationAdapter interface for Notion.
 * Supports MEETING_NOTES (create pages) and ACTION_ITEM (create database entries).
 */

import { IntegrationPlatform, IntegrationCategory } from "@prisma/client";
import type {
  IntegrationAdapter,
  OAuthTokens,
  ConnectionTestResult,
  PlatformResources,
  PushOperation,
  PushResult,
} from "../base/adapter";
import { OutputType, type ActionItemPayload, type MeetingNotesPayload } from "../base/output-types";
import { notionTokenResponseSchema, type NotionTokenResponse } from "../base/schemas";

// ============================================
// Constants
// ============================================

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ============================================
// Notion Block Types
// ============================================

interface NotionRichText {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

// ============================================
// API Helper
// ============================================

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

// ============================================
// Markdown to Notion Blocks Converter
// ============================================

/**
 * Convert markdown content to Notion block format.
 * Supports headings, lists, checkboxes, quotes, code blocks, and paragraphs.
 */
function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      i++;
      continue;
    }

    // Headings
    if (trimmedLine.startsWith("### ")) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [createRichText(trimmedLine.slice(4))],
        },
      });
    } else if (trimmedLine.startsWith("## ")) {
      blocks.push({
        type: "heading_2",
        heading_2: {
          rich_text: [createRichText(trimmedLine.slice(3))],
        },
      });
    } else if (trimmedLine.startsWith("# ")) {
      blocks.push({
        type: "heading_1",
        heading_1: {
          rich_text: [createRichText(trimmedLine.slice(2))],
        },
      });
    }
    // Checkboxes (before bullet points to avoid conflict)
    else if (trimmedLine.startsWith("- [ ] ") || trimmedLine.startsWith("- [x] ")) {
      blocks.push({
        type: "to_do",
        to_do: {
          rich_text: [createRichText(trimmedLine.slice(6))],
          checked: trimmedLine.startsWith("- [x] "),
        },
      });
    }
    // Bullet points
    else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      blocks.push({
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [createRichText(trimmedLine.slice(2))],
        },
      });
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmedLine)) {
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [createRichText(trimmedLine.replace(/^\d+\.\s/, ""))],
        },
      });
    }
    // Blockquotes
    else if (trimmedLine.startsWith("> ")) {
      blocks.push({
        type: "quote",
        quote: {
          rich_text: [createRichText(trimmedLine.slice(2))],
        },
      });
    }
    // Code blocks
    else if (trimmedLine.startsWith("```")) {
      const language = trimmedLine.slice(3) || "plain text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code",
        code: {
          rich_text: [createRichText(codeLines.join("\n"))],
          language: mapLanguageToNotion(language),
        },
      });
    }
    // Horizontal rule
    else if (trimmedLine === "---" || trimmedLine === "***" || trimmedLine === "___") {
      blocks.push({
        type: "divider",
        divider: {},
      });
    }
    // Regular paragraphs
    else {
      blocks.push({
        type: "paragraph",
        paragraph: {
          rich_text: parseInlineFormatting(trimmedLine),
        },
      });
    }

    i++;
  }

  return blocks;
}

/**
 * Create a simple rich text object
 */
function createRichText(content: string, annotations?: NotionRichText["annotations"]): NotionRichText {
  return {
    type: "text",
    text: { content },
    ...(annotations && { annotations }),
  };
}

/**
 * Parse inline markdown formatting (bold, italic, code)
 */
function parseInlineFormatting(text: string): NotionRichText[] {
  const richTextParts: NotionRichText[] = [];

  // Simple regex-based parsing for common inline formats
  // This handles: **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("**") && part.endsWith("**")) {
      richTextParts.push(createRichText(part.slice(2, -2), { bold: true }));
    } else if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      richTextParts.push(createRichText(part.slice(1, -1), { italic: true }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      richTextParts.push(createRichText(part.slice(1, -1), { code: true }));
    } else {
      richTextParts.push(createRichText(part));
    }
  }

  return richTextParts.length > 0 ? richTextParts : [createRichText(text)];
}

/**
 * Map common language names to Notion's supported language identifiers
 */
function mapLanguageToNotion(language: string): string {
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    yml: "yaml",
    "": "plain text",
  };
  return languageMap[language.toLowerCase()] || language.toLowerCase();
}

// ============================================
// Notion Adapter Implementation
// ============================================

export class NotionAdapter implements IntegrationAdapter {
  readonly platform: IntegrationPlatform = "NOTION";
  readonly category: IntegrationCategory = "DOCUMENTATION";
  readonly displayName = "Notion";

  // ============================================
  // Configuration
  // ============================================

  isConfigured(): boolean {
    return !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
  }

  // ============================================
  // OAuth
  // ============================================

  getAuthorizationUrl(state: string, callbackUrl: string): string {
    if (!this.isConfigured()) {
      throw new Error("Notion is not configured");
    }

    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.searchParams.set("client_id", process.env.NOTION_CLIENT_ID!);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("owner", "user");
    url.searchParams.set("state", state);

    return url.toString();
  }

  async exchangeCodeForTokens(code: string, callbackUrl: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) {
      throw new Error("Notion is not configured");
    }

    const clientId = process.env.NOTION_CLIENT_ID!;
    const clientSecret = process.env.NOTION_CLIENT_SECRET!;

    // Notion uses Basic auth for token exchange
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://api.notion.com/v1/oauth/token", {
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

  // ============================================
  // Connection Lifecycle
  // ============================================

  async testConnection(accessToken: string): Promise<ConnectionTestResult> {
    try {
      const result = await notionRequest<{
        bot: {
          owner: {
            type: string;
            workspace?: {
              id: string;
              name: string;
            };
            user?: {
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
          userName: result.bot?.owner?.user?.name,
          userId: result.bot?.owner?.user?.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  // ============================================
  // Resource Discovery
  // ============================================

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
    const databasesResult = await notionRequest<{
      results: Array<{
        object: "database";
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

    const databases = databasesResult.results.map((db) => ({
      id: db.id,
      name: db.title?.[0]?.plain_text || "Untitled Database",
      parentId: db.parent?.page_id || db.parent?.database_id,
    }));

    // Search for top-level pages that can serve as parents
    const pagesResult = await notionRequest<{
      results: Array<{
        object: "page";
        id: string;
        properties?: {
          title?: {
            title?: Array<{ plain_text: string }>;
          };
          Name?: {
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
      page_size: 100,
    });

    // Get both workspace-level pages and pages that could be parents
    const topLevelPages = pagesResult.results
      .filter((page) => page.parent?.workspace)
      .map((page) => ({
        id: page.id,
        name:
          page.properties?.title?.title?.[0]?.plain_text ||
          page.properties?.Name?.title?.[0]?.plain_text ||
          "Untitled Page",
      }));

    return {
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
  }

  // ============================================
  // Push Operations
  // ============================================

  async push(operation: PushOperation): Promise<PushResult> {
    const { type, payload, destination, accessToken } = operation;

    switch (type) {
      case OutputType.ACTION_ITEM:
        return this.pushActionItem(accessToken, payload as ActionItemPayload, destination);

      case OutputType.MEETING_NOTES:
        return this.pushMeetingNotes(accessToken, payload as MeetingNotesPayload, destination);

      default:
        return {
          success: false,
          error: `Unsupported output type for Notion: ${type}`,
          errorCode: "UNSUPPORTED_TYPE",
        };
    }
  }

  // ============================================
  // Action Item Push (Database Entry)
  // ============================================

  private async pushActionItem(
    accessToken: string,
    payload: ActionItemPayload,
    destination: { databaseId?: string; folderId?: string }
  ): Promise<PushResult> {
    try {
      // Build page content
      const children: NotionBlock[] = [];

      // Add description as content
      if (payload.content) {
        children.push(...markdownToNotionBlocks(payload.content));
      }

      // Add metadata section
      children.push({ type: "divider", divider: {} });

      if (payload.assignee) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              createRichText("Assignee: ", { bold: true }),
              createRichText(payload.assignee),
            ],
          },
        });
      }

      if (payload.priority) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              createRichText("Priority: ", { bold: true }),
              createRichText(payload.priority.toUpperCase()),
            ],
          },
        });
      }

      if (payload.dueDate) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              createRichText("Due: ", { bold: true }),
              createRichText(payload.dueDate.toISOString().split("T")[0]),
            ],
          },
        });
      }

      // Add source attribution
      children.push({ type: "divider", divider: {} });
      children.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            createRichText("Created from conversation by Inkra", { italic: true, color: "gray" }),
          ],
        },
      });

      // Build page body with properties
      const pageBody: Record<string, unknown> = {
        properties: this.buildActionItemProperties(payload),
        children,
      };

      // Set parent (database or page)
      if (destination.databaseId) {
        pageBody.parent = { database_id: destination.databaseId };
      } else if (destination.folderId) {
        pageBody.parent = { page_id: destination.folderId };
      } else {
        return {
          success: false,
          error: "No database or parent page specified for action item",
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
        error: error instanceof Error ? error.message : "Failed to create action item",
        errorCode: "PUSH_FAILED",
      };
    }
  }

  /**
   * Build Notion properties for action item based on common database schemas.
   * Handles both simple title-only pages and databases with standard properties.
   */
  private buildActionItemProperties(payload: ActionItemPayload): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      // Title is always required
      title: {
        title: [{ type: "text", text: { content: payload.title } }],
      },
    };

    // Add common properties if they exist in the database
    // Notion will ignore properties that don't exist in the schema
    if (payload.priority) {
      properties["Priority"] = {
        select: { name: this.mapPriorityToNotion(payload.priority) },
      };
    }

    if (payload.dueDate) {
      properties["Due Date"] = {
        date: { start: payload.dueDate.toISOString().split("T")[0] },
      };
    }

    if (payload.labels?.length) {
      properties["Tags"] = {
        multi_select: payload.labels.map((label) => ({ name: label })),
      };
    }

    return properties;
  }

  private mapPriorityToNotion(priority: string): string {
    const priorityMap: Record<string, string> = {
      urgent: "Urgent",
      high: "High",
      medium: "Medium",
      low: "Low",
    };
    return priorityMap[priority] || "Medium";
  }

  // ============================================
  // Meeting Notes Push (Create Page)
  // ============================================

  private async pushMeetingNotes(
    accessToken: string,
    payload: MeetingNotesPayload,
    destination: { databaseId?: string; folderId?: string }
  ): Promise<PushResult> {
    try {
      const children: NotionBlock[] = [];

      // Add meeting date
      if (payload.date) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              createRichText("Date: ", { bold: true }),
              createRichText(payload.date.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })),
            ],
          },
        });
      }

      // Add participants
      if (payload.participants?.length) {
        children.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              createRichText("Participants: ", { bold: true }),
              createRichText(payload.participants.join(", ")),
            ],
          },
        });
        children.push({ type: "divider", divider: {} });
      }

      // Add main content
      if (payload.content) {
        children.push({
          type: "heading_2",
          heading_2: {
            rich_text: [createRichText("Notes")],
          },
        });
        children.push(...markdownToNotionBlocks(payload.content));
      }

      // Add decisions section
      if (payload.decisions?.length) {
        children.push({
          type: "heading_2",
          heading_2: {
            rich_text: [createRichText("Decisions")],
          },
        });
        for (const decision of payload.decisions) {
          children.push({
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [createRichText(decision)],
            },
          });
        }
      }

      // Add action items section with checkboxes
      if (payload.actionItems?.length) {
        children.push({
          type: "heading_2",
          heading_2: {
            rich_text: [createRichText("Action Items")],
          },
        });
        for (const item of payload.actionItems) {
          children.push({
            type: "to_do",
            to_do: {
              rich_text: [createRichText(item)],
              checked: false,
            },
          });
        }
      }

      // Add source attribution
      children.push({ type: "divider", divider: {} });
      children.push({
        type: "paragraph",
        paragraph: {
          rich_text: [
            createRichText("Created from conversation by Inkra", { italic: true, color: "gray" }),
          ],
        },
      });

      // Build page body
      const pageBody: Record<string, unknown> = {
        properties: {
          title: {
            title: [{ type: "text", text: { content: payload.title } }],
          },
        },
        children,
      };

      // Set parent
      if (destination.databaseId) {
        pageBody.parent = { database_id: destination.databaseId };
        // Add date property if pushing to a database
        if (payload.date) {
          (pageBody.properties as Record<string, unknown>)["Date"] = {
            date: { start: payload.date.toISOString().split("T")[0] },
          };
        }
      } else if (destination.folderId) {
        pageBody.parent = { page_id: destination.folderId };
      } else {
        return {
          success: false,
          error: "No database or parent page specified for meeting notes",
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
        error: error instanceof Error ? error.message : "Failed to create meeting notes",
        errorCode: "PUSH_FAILED",
      };
    }
  }
}

// Export singleton instance
export const notionAdapter = new NotionAdapter();
