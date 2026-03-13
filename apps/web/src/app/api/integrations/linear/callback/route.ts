/**
 * Linear OAuth Callback (PX-882)
 *
 * GET /api/integrations/linear/callback
 */

import { createOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createOAuthCallbackHandler("LINEAR");
