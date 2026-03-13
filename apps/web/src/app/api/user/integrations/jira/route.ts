/**
 * User Jira Integration Status/Disconnect
 *
 * GET  - Get user's Jira connection status
 * DELETE - Disconnect user's Jira account
 */

import {
  createUserConnectionStatusHandler,
  createUserDisconnectHandler,
} from "@/lib/integrations/base";

export const GET = createUserConnectionStatusHandler("JIRA");
export const DELETE = createUserDisconnectHandler("JIRA");
