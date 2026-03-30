/**
 * Linear Integration (PX-882, PX-1007)
 *
 * Re-exports Linear WorkflowService/IntegrationAdapter and helper functions.
 *
 * The LinearWorkflowService class implements both interfaces:
 * - WorkflowService: Legacy interface for pushing action items
 * - IntegrationAdapter: New unified interface for Integration Hub (PX-1007)
 */

export {
  LinearWorkflowService,
  linearWorkflowService,
  type LinearPlatformResources,
} from "./service";
export * from "./types";

// Legacy exports for backward compatibility
// These use the org-based token lookup pattern
export {
  createLinearIssue,
  addDelaySignalComment,
  getLinearTeams,
  getLinearProjects,
  testLinearConnection,
  searchLinearIssues,
} from "../linear";
