/**
 * Notion Integration (PX-882, PX-1006)
 *
 * Re-exports Notion adapter, service, and helper functions.
 */

// New IntegrationAdapter implementation (PX-1006)
export { NotionAdapter, notionAdapter } from "./adapter";

// Legacy WorkflowService implementation (PX-882)
export { NotionWorkflowService, notionWorkflowService } from "./service";

export * from "./types";

// Legacy exports for backward compatibility
export {
  createNotionPage,
  getNotionDatabases,
  testNotionConnection,
} from "../notion";
