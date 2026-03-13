/**
 * User Jira OAuth Authorize
 *
 * GET - Initiate OAuth flow for user to connect their Jira account
 */

import { createUserOAuthAuthorizeHandler } from "@/lib/integrations/base";

export const GET = createUserOAuthAuthorizeHandler("JIRA");
