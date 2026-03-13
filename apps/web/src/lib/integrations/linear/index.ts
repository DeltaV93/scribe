/**
 * Linear Integration (PX-882)
 *
 * Re-exports Linear WorkflowService and helper functions.
 */

export { LinearWorkflowService, linearWorkflowService } from "./service";
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
