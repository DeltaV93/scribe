/**
 * Jira-specific types (PX-882)
 */

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: JiraAdfDocument;
    issuetype: { name: string; id: string };
    project: { key: string; name: string };
    status: { name: string; id: string };
    priority?: { name: string; id: string };
    assignee?: JiraUser;
    reporter?: JiraUser;
    duedate?: string;
  };
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraAccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
}

/**
 * Atlassian Document Format (ADF) types
 */
export interface JiraAdfDocument {
  type: "doc";
  version: 1;
  content: JiraAdfNode[];
}

export interface JiraAdfNode {
  type: string;
  content?: JiraAdfNode[];
  text?: string;
  marks?: JiraAdfMark[];
  attrs?: Record<string, unknown>;
}

export interface JiraAdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface JiraCreateIssueRequest {
  fields: {
    summary: string;
    description?: JiraAdfDocument;
    issuetype: { name?: string; id?: string };
    project: { key?: string; id?: string };
    priority?: { name?: string; id?: string };
    assignee?: { accountId: string };
    duedate?: string;
    labels?: string[];
  };
}

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

export interface JiraProjectSearchResponse {
  values: JiraProject[];
  maxResults: number;
  total: number;
}

export interface JiraIssueTypeResponse {
  id: string;
  name: string;
  description: string;
  subtask: boolean;
}
