/**
 * Workflow Integrations - Reusable OAuth Handlers (PX-882)
 *
 * Factory functions that create OAuth route handlers with built-in:
 * - Rate limiting
 * - RBAC permission checks
 * - Audit logging
 * - State validation
 * - Error handling
 *
 * Usage:
 * ```typescript
 * // api/integrations/linear/authorize/route.ts
 * export const GET = createOAuthAuthorizeHandler("LINEAR");
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/service";
import {
  requireIntegrationAuth,
  requireIntegrationPermission,
  generateOAuthState,
  parseOAuthState,
  validateRedirectUrl,
  redirectWithError,
  redirectWithSuccess,
  integrationErrorResponse,
  getClientIp,
  getUserAgent,
} from "./security";
import { getWorkflowService } from "./registry";
import { storeIntegrationConnection, getCallbackUrl } from "./token-store";
import type { WorkflowPlatform, PlatformConfig } from "./types";

// ============================================
// OAuth Authorize Handler
// ============================================

/**
 * Create an OAuth authorization handler for a platform
 *
 * GET /api/integrations/{platform}/authorize
 *
 * Includes:
 * - Authentication check
 * - RBAC permission check
 * - Platform configuration check
 * - State generation with redirect validation
 * - Audit logging
 */
export function createOAuthAuthorizeHandler(platform: WorkflowPlatform) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      // 1. Check authentication
      const authResult = await requireIntegrationAuth();
      if (!authResult.user) {
        return authResult.response;
      }
      const { user } = authResult;

      // 2. Check RBAC permission
      const permCheck = await requireIntegrationPermission(user);
      if (!permCheck.allowed) {
        return permCheck.response;
      }

      // 3. Get platform service and check configuration
      const service = getWorkflowService(platform);
      if (!service.isConfigured()) {
        return integrationErrorResponse(
          "NOT_CONFIGURED",
          `${platform} OAuth is not configured on this server`,
          400
        );
      }

      // 4. Get and validate redirect URL
      const redirectUrl =
        request.nextUrl.searchParams.get("redirectUrl") ||
        "/settings/integrations";
      const validatedRedirect = validateRedirectUrl(redirectUrl);

      // 5. Generate state
      const state = generateOAuthState(
        platform,
        user.orgId,
        user.id,
        validatedRedirect
      );

      // 6. Build authorization URL
      const callbackUrl = getCallbackUrl(platform);
      const authorizationUrl = service.getAuthorizationUrl(state, callbackUrl);

      // 7. Log OAuth initiation
      console.log(
        `[${platform} OAuth] Initiated: org=${user.orgId} user=${user.id}`
      );

      return NextResponse.json({ authorizationUrl });
    } catch (error) {
      console.error(`[${platform} Authorize] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to initiate OAuth flow"
      );
    }
  };
}

// ============================================
// OAuth Callback Handler
// ============================================

/**
 * Create an OAuth callback handler for a platform
 *
 * GET /api/integrations/{platform}/callback
 *
 * Includes:
 * - Error handling from OAuth provider
 * - State validation (CSRF protection)
 * - Platform verification
 * - Token exchange with Zod validation
 * - Connection testing
 * - Encrypted token storage
 * - Audit logging
 */
export function createOAuthCallbackHandler(platform: WorkflowPlatform) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const defaultRedirect = "/settings/integrations";

    // 1. Check for OAuth error from provider
    const error = searchParams.get("error");
    if (error) {
      console.error(`[${platform} OAuth] Provider error:`, error);
      return redirectWithError(defaultRedirect, error, platform);
    }

    // 2. Get authorization code
    const code = searchParams.get("code");
    if (!code) {
      return redirectWithError(
        defaultRedirect,
        "Authorization code missing",
        platform
      );
    }

    // 3. Get and validate state
    const stateParam = searchParams.get("state");
    if (!stateParam) {
      return redirectWithError(
        defaultRedirect,
        "State parameter missing",
        platform
      );
    }

    const state = parseOAuthState(stateParam);
    if (!state) {
      return redirectWithError(
        defaultRedirect,
        "Invalid or expired state parameter",
        platform
      );
    }

    // 4. Verify platform matches
    if (state.platform !== platform) {
      return redirectWithError(
        state.redirectUrl || defaultRedirect,
        "Platform mismatch in callback",
        platform
      );
    }

    try {
      // 5. Get service and exchange code for tokens
      const service = getWorkflowService(platform);
      const callbackUrl = getCallbackUrl(platform);
      const tokens = await service.exchangeCodeForTokens(code, callbackUrl);

      // 6. Test connection
      const testResult = await service.testConnection(tokens.accessToken);
      if (!testResult.success) {
        return redirectWithError(
          state.redirectUrl || defaultRedirect,
          testResult.error || `Failed to verify ${platform} connection`,
          platform
        );
      }

      // 7. Build platform config from test result
      const config: PlatformConfig = {
        workspaceId: testResult.details?.workspaceId,
        workspaceName: testResult.details?.workspaceName,
      };

      // 8. Store connection
      const connectionName =
        testResult.details?.workspaceName || platform;

      await storeIntegrationConnection(
        state.orgId,
        platform,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
        config,
        connectionName,
        state.userId
      );

      // 9. Create audit log
      await createAuditLog({
        orgId: state.orgId,
        userId: state.userId,
        action: "CREATE",
        resource: "INTEGRATION",
        resourceId: `${state.orgId}:${platform}`,
        resourceName: `${platform} Integration`,
        details: {
          platform,
          workspaceName: testResult.details?.workspaceName,
          action: "connected",
        },
        ipAddress: getClientIp(request) || undefined,
        userAgent: getUserAgent(request) || undefined,
      });

      console.log(
        `[${platform} OAuth] Connected: org=${state.orgId} workspace=${connectionName}`
      );

      return redirectWithSuccess(
        state.redirectUrl || defaultRedirect,
        platform
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${platform} OAuth] Completion failed:`, error);
      return redirectWithError(
        state.redirectUrl || defaultRedirect,
        message,
        platform
      );
    }
  };
}
