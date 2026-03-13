/**
 * Jira Connection Status (PX-882)
 *
 * GET /api/integrations/jira - Get connection status
 * DELETE /api/integrations/jira - Disconnect
 */

import {
  createGetConnectionHandler,
  createDeleteConnectionHandler,
} from "@/lib/integrations/base";

export const GET = createGetConnectionHandler("JIRA");
export const DELETE = createDeleteConnectionHandler("JIRA");
