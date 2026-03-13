/**
 * Jira OAuth Authorization (PX-882)
 *
 * GET /api/integrations/jira/authorize
 */

import { createOAuthAuthorizeHandler } from "@/lib/integrations/base";

export const GET = createOAuthAuthorizeHandler("JIRA");
