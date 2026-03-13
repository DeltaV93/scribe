/**
 * Integration Settings Components
 *
 * Re-exports for integration UI components.
 */

// Calendar integration
export { CalendarIntegrationSection } from "./CalendarIntegrationSection";
export { CalendarProviderButton, PROVIDER_CONFIG } from "./CalendarProviderButton";
export type { CalendarProvider } from "./CalendarProviderButton";
export { ConnectedCalendarCard } from "./ConnectedCalendarCard";

// Workflow integrations (PX-882)
// Admin view - toggle to enable platforms for org
export { AdminWorkflowPlatformsSection } from "./AdminWorkflowPlatformsSection";
// Legacy: Org-level OAuth connection (deprecated, kept for reference)
export { WorkflowIntegrationSection } from "./WorkflowIntegrationSection";
