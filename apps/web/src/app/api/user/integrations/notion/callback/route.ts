/**
 * User Notion OAuth Callback
 *
 * GET - Handle OAuth callback and store user's Notion tokens
 */

import { createUserOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createUserOAuthCallbackHandler("NOTION");
