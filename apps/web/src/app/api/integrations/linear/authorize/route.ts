/**
 * Linear OAuth Authorization (PX-882)
 *
 * GET /api/integrations/linear/authorize
 */

import { createOAuthAuthorizeHandler } from "@/lib/integrations/base";

export const GET = createOAuthAuthorizeHandler("LINEAR");
