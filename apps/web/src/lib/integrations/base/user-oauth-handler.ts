/**
 * Per-User OAuth Handlers (PX-882)
 *
 * Factory functions for user-level OAuth flows. Unlike org-level handlers,
 * these allow any authenticated user to connect their own account.
 *
 * Key differences from org-level:
 * - No admin permission required (any user can connect)
 * - Must verify platform is enabled for org
 * - Stores to UserIntegrationConnection
 * - Uses user-specific callback URLs
 *
 * Usage:
 * ```typescript
 * // api/user/integrations/linear/authorize/route.ts
 * export const GET = createUserOAuthAuthorizeHandler("LINEAR");
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/service";
import { isWorkflowPlatformEnabled } from "@/lib/features/flags";
import {
  requireIntegrationAuth,
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
import {
  storeUserIntegrationConnection,
  getUserIntegrationConnection,
  getUserCallbackUrl,
  disconnectUserIntegration,
} from "./user-token-store";
import type { WorkflowPlatform, PlatformConfig } from "./types";

// ============================================
// User OAuth Authorize Handler
// ============================================

/**
 * Create a user OAuth authorization handler for a platform
 *
 * GET /api/user/integrations/{platform}/authorize
 *
 * Prerequisites:
 * - User must be authenticated
 * - Platform must be enabled for user's org (feature flag)
 * - Platform OAuth must be configured (env vars)
 */
export function createUserOAuthAuthorizeHandler(platform: WorkflowPlatform) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      // 1. Check authentication
      const authResult = await requireIntegrationAuth();
      if (!authResult.user) {
        return authResult.response;
      }
      const { user } = authResult;

      // 2. Check if platform is enabled for org
      const platformEnabled = await isWorkflowPlatformEnabled(user.orgId, platform);
      if (!platformEnabled) {
        return integrationErrorResponse(
          "PLATFORM_NOT_ENABLED",
          `${platform} is not enabled for your organization. Ask your admin to enable it in Settings.`,
          403
        );
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
        "/settings/personal/integrations";
      const validatedRedirect = validateRedirectUrl(redirectUrl);

      // 5. Generate state
      const state = generateOAuthState(
        platform,
        user.orgId,
        user.id,
        validatedRedirect
      );

      // 6. Build authorization URL with user callback
      const callbackUrl = getUserCallbackUrl(platform);
      const authorizationUrl = service.getAuthorizationUrl(state, callbackUrl);

      // 7. Log OAuth initiation
      console.log(
        `[${platform} User OAuth] Initiated: org=${user.orgId} user=${user.id}`
      );

      return NextResponse.json({ authorizationUrl });
    } catch (error) {
      console.error(`[${platform} User Authorize] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to initiate OAuth flow"
      );
    }
  };
}

// ============================================
// User OAuth Callback Handler
// ============================================

/**
 * Create a user OAuth callback handler for a platform
 *
 * GET /api/user/integrations/{platform}/callback
 *
 * Stores tokens in UserIntegrationConnection for the user who initiated.
 */
export function createUserOAuthCallbackHandler(platform: WorkflowPlatform) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const defaultRedirect = "/settings/personal/integrations";

    // 1. Check for OAuth error from provider
    const error = searchParams.get("error");
    if (error) {
      console.error(`[${platform} User OAuth] Provider error:`, error);
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

    // 5. Verify platform is still enabled for org
    const platformEnabled = await isWorkflowPlatformEnabled(state.orgId, platform);
    if (!platformEnabled) {
      return redirectWithError(
        state.redirectUrl || defaultRedirect,
        `${platform} was disabled for your organization`,
        platform
      );
    }

    try {
      // 6. Get service and exchange code for tokens
      const service = getWorkflowService(platform);
      const callbackUrl = getUserCallbackUrl(platform);
      const tokens = await service.exchangeCodeForTokens(code, callbackUrl);

      // 7. Test connection and get user identity
      const testResult = await service.testConnection(tokens.accessToken);
      if (!testResult.success) {
        return redirectWithError(
          state.redirectUrl || defaultRedirect,
          testResult.error || `Failed to verify ${platform} connection`,
          platform
        );
      }

      // 8. Build platform config from test result
      const config: PlatformConfig = {
        workspaceId: testResult.details?.workspaceId,
        workspaceName: testResult.details?.workspaceName,
      };

      // 9. Store user connection
      await storeUserIntegrationConnection(
        state.userId,
        state.orgId,
        platform,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt,
        config,
        testResult.details?.userId, // External user ID in Linear/Notion/Jira
        testResult.details?.userName // External display name
      );

      // 10. Create audit log
      await createAuditLog({
        orgId: state.orgId,
        userId: state.userId,
        action: "CREATE",
        resource: "USER_INTEGRATION",
        resourceId: `${state.userId}:${platform}`,
        resourceName: `${platform} User Connection`,
        details: {
          platform,
          externalUserId: testResult.details?.userId,
          externalUserName: testResult.details?.userName,
          workspaceName: testResult.details?.workspaceName,
          action: "user_connected",
        },
        ipAddress: getClientIp(request) || undefined,
        userAgent: getUserAgent(request) || undefined,
      });

      console.log(
        `[${platform} User OAuth] Connected: org=${state.orgId} user=${state.userId} externalUser=${testResult.details?.userName || "unknown"}`
      );

      return redirectWithSuccess(
        state.redirectUrl || defaultRedirect,
        platform
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${platform} User OAuth] Completion failed:`, error);
      return redirectWithError(
        state.redirectUrl || defaultRedirect,
        message,
        platform
      );
    }
  };
}

// ============================================
// User Connection Status Handler
// ============================================

/**
 * Create a handler to get user's connection status for a platform
 *
 * GET /api/user/integrations/{platform}
 *
 * Returns:
 * - connected: boolean
 * - platformEnabled: boolean
 * - connection details (if connected)
 */
export function createUserConnectionStatusHandler(platform: WorkflowPlatform) {
  return async function GET(_request: NextRequest): Promise<NextResponse> {
    try {
      // 1. Check authentication
      const authResult = await requireIntegrationAuth();
      if (!authResult.user) {
        return authResult.response;
      }
      const { user } = authResult;

      // 2. Check if platform is enabled for org
      const platformEnabled = await isWorkflowPlatformEnabled(user.orgId, platform);

      // 3. Get user's connection
      const connection = await getUserIntegrationConnection(user.id, platform);

      return NextResponse.json({
        connected: connection?.status === "ACTIVE",
        platformEnabled,
        connection: connection
          ? {
              id: connection.id,
              status: connection.status,
              externalUserName: connection.externalUserName,
              lastUsedAt: connection.lastUsedAt,
              lastError: connection.lastError,
              connectedAt: connection.connectedAt,
            }
          : null,
      });
    } catch (error) {
      console.error(`[${platform} User Status] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to get connection status"
      );
    }
  };
}

// ============================================
// User Disconnect Handler
// ============================================

/**
 * Create a handler to disconnect user's integration
 *
 * DELETE /api/user/integrations/{platform}
 */
export function createUserDisconnectHandler(platform: WorkflowPlatform) {
  return async function DELETE(request: NextRequest): Promise<NextResponse> {
    try {
      // 1. Check authentication
      const authResult = await requireIntegrationAuth();
      if (!authResult.user) {
        return authResult.response;
      }
      const { user } = authResult;

      // 2. Disconnect
      await disconnectUserIntegration(user.id, platform);

      // 3. Create audit log
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "DELETE",
        resource: "USER_INTEGRATION",
        resourceId: `${user.id}:${platform}`,
        resourceName: `${platform} User Connection`,
        details: {
          platform,
          action: "user_disconnected",
        },
        ipAddress: getClientIp(request) || undefined,
        userAgent: getUserAgent(request) || undefined,
      });

      console.log(
        `[${platform} User OAuth] Disconnected: org=${user.orgId} user=${user.id}`
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`[${platform} User Disconnect] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to disconnect integration"
      );
    }
  };
}
