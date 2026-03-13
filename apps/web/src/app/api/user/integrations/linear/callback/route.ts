/**
 * User Linear OAuth Callback
 *
 * GET - Handle OAuth callback and store user's Linear tokens
 */

import { createUserOAuthCallbackHandler } from "@/lib/integrations/base";

export const GET = createUserOAuthCallbackHandler("LINEAR");
