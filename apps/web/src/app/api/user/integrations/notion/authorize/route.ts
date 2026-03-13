/**
 * User Notion OAuth Authorize
 *
 * GET - Initiate OAuth flow for user to connect their Notion account
 */

import { createUserOAuthAuthorizeHandler } from "@/lib/integrations/base";

export const GET = createUserOAuthAuthorizeHandler("NOTION");
