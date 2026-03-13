/**
 * Linear-specific types (PX-882)
 */

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
}

export interface LinearCreateIssueResponse {
  data?: {
    issueCreate: {
      success: boolean;
      issue?: LinearIssue;
    };
  };
  errors?: Array<{ message: string }>;
}

export interface LinearViewerResponse {
  data?: {
    viewer: {
      id: string;
      name: string;
      organization: {
        id: string;
        name: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

export interface LinearTeamsResponse {
  data: {
    teams: {
      nodes: LinearTeam[];
    };
  };
}

export interface LinearProjectsResponse {
  data: {
    team: {
      projects: {
        nodes: LinearProject[];
      };
    };
  };
}

export interface LinearSearchResponse {
  data: {
    issueSearch: {
      nodes: LinearIssue[];
    };
  };
}
