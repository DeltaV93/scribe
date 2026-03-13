/**
 * User Notion Integration Status/Disconnect
 *
 * GET  - Get user's Notion connection status
 * DELETE - Disconnect user's Notion account
 */

import {
  createUserConnectionStatusHandler,
  createUserDisconnectHandler,
} from "@/lib/integrations/base";

export const GET = createUserConnectionStatusHandler("NOTION");
export const DELETE = createUserDisconnectHandler("NOTION");
