/**
 * Workflow Integrations - Connection Handlers (PX-882)
 *
 * Factory functions that create connection status and disconnect handlers
 * with built-in security and audit logging.
 *
 * Usage:
 * ```typescript
 * // api/integrations/linear/route.ts
 * export const GET = createGetConnectionHandler("LINEAR");
 * export const DELETE = createDeleteConnectionHandler("LINEAR");
 * ```
 */

import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/service";
import {
  requireIntegrationAuth,
  requireIntegrationPermission,
  integrationErrorResponse,
} from "./security";
import {
  getIntegrationConnection,
  deleteIntegrationConnection,
  isPlatformConfigured,
} from "./token-store";
import type { WorkflowPlatform, ConnectionStatusResponse } from "./types";

// ============================================
// Get Connection Status Handler
// ============================================

/**
 * Create a GET handler for connection status
 *
 * GET /api/integrations/{platform}
 *
 * Returns:
 * - connected: boolean
 * - configured: boolean (env vars present)
 * - connection: { id, name, lastUsedAt, lastError } | null
 */
export function createGetConnectionHandler(platform: WorkflowPlatform) {
  return async function GET(): Promise<NextResponse> {
    try {
      // 1. Check authentication
      const authResult = await requireIntegrationAuth();
      if (!authResult.user) {
        return authResult.response;
      }
      const { user } = authResult;

      // 2. Get connection status
      const connection = await getIntegrationConnection(user.orgId, platform);

      const response: ConnectionStatusResponse = {
        connected: !!connection,
        configured: isPlatformConfigured(platform),
        connection: connection
          ? {
              id: connection.id,
              name: connection.name,
              lastUsedAt: connection.lastUsedAt ?? null,
              lastError: connection.lastError ?? null,
            }
          : null,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error(`[${platform} Status] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to get connection status"
      );
    }
  };
}

// ============================================
// Delete Connection Handler
// ============================================

/**
 * Create a DELETE handler for disconnecting
 *
 * DELETE /api/integrations/{platform}
 *
 * Includes:
 * - Authentication check
 * - RBAC permission check
 * - Audit logging
 */
export function createDeleteConnectionHandler(platform: WorkflowPlatform) {
  return async function DELETE(): Promise<NextResponse> {
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

      // 3. Get existing connection for audit log
      const existingConnection = await getIntegrationConnection(
        user.orgId,
        platform
      );

      // 4. Delete connection
      await deleteIntegrationConnection(user.orgId, platform);

      // 5. Create audit log
      await createAuditLog({
        orgId: user.orgId,
        userId: user.id,
        action: "DELETE",
        resource: "INTEGRATION",
        resourceId: existingConnection?.id || `${user.orgId}:${platform}`,
        resourceName: `${platform} Integration`,
        details: {
          platform,
          connectionName: existingConnection?.name,
          action: "disconnected",
        },
      });

      console.log(`[${platform}] Disconnected: org=${user.orgId}`);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error(`[${platform} Disconnect] Error:`, error);
      return integrationErrorResponse(
        "INTERNAL_ERROR",
        "Failed to disconnect integration"
      );
    }
  };
}
