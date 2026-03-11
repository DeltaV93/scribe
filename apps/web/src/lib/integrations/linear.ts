/**
 * Linear Integration Client (PX-865)
 * Push action items and updates to Linear
 */

import { prisma } from "@/lib/db";
import type { ActionItemDraft, DelaySignalDraft } from "@/lib/services/workflow-outputs";

// Linear API base URL
const LINEAR_API_URL = "https://api.linear.app/graphql";

interface LinearConfig {
  teamId?: string;
  projectId?: string;
  defaultLabels?: string[];
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
}

interface LinearCreateIssueResponse {
  data?: {
    issueCreate: {
      success: boolean;
      issue?: LinearIssue;
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Get Linear access token for organization
 */
async function getAccessToken(orgId: string): Promise<string | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      orgId,
      platform: "LINEAR",
      isActive: true,
    },
    select: {
      accessToken: true,
    },
  });

  return connection?.accessToken || null;
}

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

/**
 * Create an issue in Linear from an action item draft
 */
export async function createLinearIssue(
  orgId: string,
  draft: ActionItemDraft,
  config?: LinearConfig
): Promise<LinearIssue> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Linear not connected for this organization");
  }

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

  const variables = {
    input: {
      title: draft.title,
      description,
      priority: priorityMap[draft.priority || "medium"],
      ...(config?.teamId && { teamId: config.teamId }),
      ...(config?.projectId && { projectId: config.projectId }),
      ...(draft.dueDate && { dueDate: draft.dueDate }),
      ...(draft.labels?.length && { labelIds: draft.labels }),
    },
  };

  const result = await linearQuery<LinearCreateIssueResponse>(
    accessToken,
    mutation,
    variables
  );

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  if (!result.data?.issueCreate.success || !result.data.issueCreate.issue) {
    throw new Error("Failed to create Linear issue");
  }

  return result.data.issueCreate.issue;
}

/**
 * Create delay signal as a comment on existing issue
 */
export async function addDelaySignalComment(
  orgId: string,
  issueId: string,
  signal: DelaySignalDraft
): Promise<void> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Linear not connected for this organization");
  }

  const mutation = `
    mutation CreateComment($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
      }
    }
  `;

  const body = `
**⚠️ Delay Signal Detected**

**Type:** ${signal.delayType}
**Estimated Delay:** ${signal.delayDays} days
**Confidence:** ${Math.round(signal.confidence * 100)}%

**Reason:**
${signal.reason}

> "${signal.sourceSnippet}"

*Detected from conversation by Inkra*
  `.trim();

  await linearQuery(accessToken, mutation, {
    input: {
      issueId,
      body,
    },
  });
}

/**
 * Get teams for organization (for config UI)
 */
export async function getLinearTeams(
  orgId: string
): Promise<Array<{ id: string; name: string; key: string }>> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Linear not connected for this organization");
  }

  const query = `
    query Teams {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const result = await linearQuery<{
    data: { teams: { nodes: Array<{ id: string; name: string; key: string }> } };
  }>(accessToken, query);

  return result.data.teams.nodes;
}

/**
 * Get projects for a team (for config UI)
 */
export async function getLinearProjects(
  orgId: string,
  teamId: string
): Promise<Array<{ id: string; name: string }>> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Linear not connected for this organization");
  }

  const query = `
    query Projects($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
          }
        }
      }
    }
  `;

  const result = await linearQuery<{
    data: { team: { projects: { nodes: Array<{ id: string; name: string }> } } };
  }>(accessToken, query, { teamId });

  return result.data.team.projects.nodes;
}

/**
 * Test Linear connection
 */
export async function testLinearConnection(accessToken: string): Promise<{
  success: boolean;
  organizationName?: string;
  error?: string;
}> {
  try {
    const query = `
      query Viewer {
        viewer {
          id
          name
          organization {
            name
          }
        }
      }
    `;

    const result = await linearQuery<{
      data?: { viewer: { organization: { name: string } } };
      errors?: Array<{ message: string }>;
    }>(accessToken, query);

    if (result.errors?.length) {
      return { success: false, error: result.errors[0].message };
    }

    return {
      success: true,
      organizationName: result.data?.viewer.organization.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Search for issues by title (for linking to existing)
 */
export async function searchLinearIssues(
  orgId: string,
  query: string
): Promise<LinearIssue[]> {
  const accessToken = await getAccessToken(orgId);
  if (!accessToken) {
    throw new Error("Linear not connected for this organization");
  }

  const searchQuery = `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 10) {
        nodes {
          id
          identifier
          title
          url
        }
      }
    }
  `;

  const result = await linearQuery<{
    data: { issueSearch: { nodes: LinearIssue[] } };
  }>(accessToken, searchQuery, { query });

  return result.data.issueSearch.nodes;
}
