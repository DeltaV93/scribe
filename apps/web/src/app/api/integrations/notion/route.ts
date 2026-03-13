/**
 * Notion Connection Status (PX-882)
 *
 * GET /api/integrations/notion - Get connection status
 * DELETE /api/integrations/notion - Disconnect
 */

import {
  createGetConnectionHandler,
  createDeleteConnectionHandler,
} from "@/lib/integrations/base";

export const GET = createGetConnectionHandler("NOTION");
export const DELETE = createDeleteConnectionHandler("NOTION");
