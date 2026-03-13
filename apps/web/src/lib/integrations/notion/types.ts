/**
 * Notion-specific types (PX-882)
 */

export interface NotionPage {
  id: string;
  url: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
}

export interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

export interface NotionUserResponse {
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
}

export interface NotionSearchResponse {
  results: Array<{
    id: string;
    object: string;
    title?: Array<{ plain_text: string }>;
  }>;
  has_more: boolean;
  next_cursor: string | null;
}
