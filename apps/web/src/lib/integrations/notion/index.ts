/**
 * Notion Integration (PX-882)
 *
 * Re-exports Notion WorkflowService and helper functions.
 */

export { NotionWorkflowService, notionWorkflowService } from "./service";
export * from "./types";

// Legacy exports for backward compatibility
export {
  createNotionPage,
  getNotionDatabases,
  testNotionConnection,
} from "../notion";
