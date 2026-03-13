/**
 * User Linear Integration Status/Disconnect
 *
 * GET  - Get user's Linear connection status
 * DELETE - Disconnect user's Linear account
 */

import {
  createUserConnectionStatusHandler,
  createUserDisconnectHandler,
} from "@/lib/integrations/base";

export const GET = createUserConnectionStatusHandler("LINEAR");
export const DELETE = createUserDisconnectHandler("LINEAR");
