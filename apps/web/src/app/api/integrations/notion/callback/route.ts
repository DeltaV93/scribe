/**
 * Notion OAuth Callback (PX-882)
 *
 * GET /api/integrations/notion/callback
 */

import { createOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createOAuthCallbackHandler("NOTION");
