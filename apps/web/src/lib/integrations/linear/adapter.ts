/**
 * Linear Integration Adapter (PX-1007)
 *
 * Re-exports LinearWorkflowService as LinearAdapter for the adapter registry.
 * The service already implements both WorkflowService and IntegrationAdapter interfaces.
 */

export { LinearWorkflowService as LinearAdapter } from "./service";
