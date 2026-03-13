/**
 * Notion OAuth Authorization (PX-882)
 *
 * GET /api/integrations/notion/authorize
 */

import { createOAuthAuthorizeHandler } from "@/lib/integrations/base";

export const GET = createOAuthAuthorizeHandler("NOTION");
