/**
 * Linear Connection Status (PX-882)
 *
 * GET /api/integrations/linear - Get connection status
 * DELETE /api/integrations/linear - Disconnect
 */

import {
  createGetConnectionHandler,
  createDeleteConnectionHandler,
} from "@/lib/integrations/base";

export const GET = createGetConnectionHandler("LINEAR");
export const DELETE = createDeleteConnectionHandler("LINEAR");
