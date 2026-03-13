/**
 * Jira OAuth Callback (PX-882)
 *
 * GET /api/integrations/jira/callback
 */

import { createOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createOAuthCallbackHandler("JIRA");
