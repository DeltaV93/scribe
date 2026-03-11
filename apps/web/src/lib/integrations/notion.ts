/**
 * Notion Integration Client (PX-865)
 * Push meeting notes and documents to Notion
 */

import { prisma } from "@/lib/db";
import type { MeetingNotesDraft } from "@/lib/services/workflow-outputs";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionConfig {
  databaseId?: string;
  parentPageId?: string;
}

interface NotionPage {
  id: string;
  url: string;
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

/**
 * Get Notion access token for organization
 */
async function getAccessToken(orgId: string): Promise<string | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      orgId,
      platform: "NOTION",
      isActive: true,
    },
    select: {
      accessToken: true,
    },
  });

  return connection?.accessToken || null;
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
    const error = await response.json();
    throw new Error(error.message || `Notion API error: ${response.status}`);
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
          rich_text: [{ type: "text", text: { content: line.replace(/^\d+\.\s/, "") } }],
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

/**
 * Create a page in Notion from meeting notes
 */
export async function createNotionPage(
  orgId: string,
  draft: MeetingNotesDraft,
  config?: NotionConfig
): Promise<NotionPage> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Notion not connected for this organization");
  }

  // Build page content
  const children: NotionBlock[] = [];

  // Add attendees
  if (draft.attendees.length > 0) {
    children.push({
      type: "paragraph",
      paragraph: {
        rich_text: [
          { type: "text", text: { content: "Attendees: ", annotations: { bold: true } } },
          { type: "text", text: { content: draft.attendees.join(", ") } },
        ],
      },
    });
    children.push({ type: "divider", divider: {} });
  }

  // Add sections
  for (const section of draft.sections) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: section.heading } }],
      },
    });
    children.push(...markdownToNotionBlocks(section.content));
  }

  // Add action items
  if (draft.actionItems.length > 0) {
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

  // Add key decisions
  if (draft.keyDecisions.length > 0) {
    children.push({
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Key Decisions" } }],
      },
    });
    for (const decision of draft.keyDecisions) {
      children.push({
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: decision } }],
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

  // Create page
  const pageBody: Record<string, unknown> = {
    properties: {
      title: {
        title: [{ type: "text", text: { content: draft.title } }],
      },
    },
    children,
  };

  // Set parent (database or page)
  if (config?.databaseId) {
    pageBody.parent = { database_id: config.databaseId };
  } else if (config?.parentPageId) {
    pageBody.parent = { page_id: config.parentPageId };
  } else {
    throw new Error("No database or parent page specified");
  }

  const result = await notionRequest<NotionPage>(accessToken, "/pages", "POST", pageBody);

  return {
    id: result.id,
    url: result.url,
  };
}

/**
 * Get available databases (for config UI)
 */
export async function getNotionDatabases(
  orgId: string
): Promise<Array<{ id: string; title: string }>> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Notion not connected for this organization");
  }

  const result = await notionRequest<{
    results: Array<{
      id: string;
      title: Array<{ plain_text: string }>;
    }>;
  }>(accessToken, "/search", "POST", {
    filter: { property: "object", value: "database" },
  });

  return result.results.map((db) => ({
    id: db.id,
    title: db.title[0]?.plain_text || "Untitled",
  }));
}

/**
 * Test Notion connection
 */
export async function testNotionConnection(accessToken: string): Promise<{
  success: boolean;
  workspaceName?: string;
  error?: string;
}> {
  try {
    const result = await notionRequest<{
      bot: { owner: { workspace: { name: string } } };
    }>(accessToken, "/users/me", "GET");

    return {
      success: true,
      workspaceName: result.bot?.owner?.workspace?.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
