/**
 * Integrations Module (PX-865)
 * External platform integrations for workflow outputs
 */

// Linear
export {
  createLinearIssue,
  addDelaySignalComment,
  getLinearTeams,
  getLinearProjects,
  testLinearConnection,
  searchLinearIssues,
} from "./linear";

// Google Calendar
export {
  createCalendarEvent,
  getCalendars,
  testCalendarConnection,
  checkConflicts,
} from "./google-calendar";

// Notion
export {
  createNotionPage,
  getNotionDatabases,
  testNotionConnection,
} from "./notion";

// Notion Adapter (PX-1006)
export { NotionAdapter, notionAdapter } from "./notion/adapter";
