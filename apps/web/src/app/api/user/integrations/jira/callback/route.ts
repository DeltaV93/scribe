/**
 * User Jira OAuth Callback
 *
 * GET - Handle OAuth callback and store user's Jira tokens
 */

import { createUserOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createUserOAuthCallbackHandler("JIRA");
