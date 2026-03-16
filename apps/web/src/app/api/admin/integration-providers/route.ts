/**
 * Admin Integration Providers API (PX-1001 Phase 3)
 *
 * Manages the IntegrationProvider registry.
 * Provides endpoints for listing, enabling/disabling, and syncing providers.
 *
 * GET  - List all providers with their configuration status
 * PUT  - Enable/disable a specific provider
 * POST - Sync providers from environment variables (system admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit/service";
import {
  listProviders,
  getProvider,
  setProviderEnabled,
  syncProvidersFromEnv,
  getProviderStats,
} from "@/lib/integrations/base/provider-registry";
import { IntegrationPlatform, IntegrationCategory } from "@prisma/client";

// Request schema for updating provider
const updateProviderSchema = z.object({
  platform: z.enum(["LINEAR", "JIRA", "NOTION", "GOOGLE_DOCS", "GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"]),
  enabled: z.boolean(),
});

// Request schema for syncing providers
const syncProvidersSchema = z.object({
  systemOrgId: z.string().uuid(),
});

/**
 * GET /api/admin/integration-providers
 *
 * Returns all integration providers with their configuration status.
 * Query params:
 *   - category: Filter by IntegrationCategory
 *   - stats: If "true", returns summary stats instead of full list
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Check admin permission
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const categoryParam = searchParams.get("category") as IntegrationCategory | null;
    const wantStats = searchParams.get("stats") === "true";

    // 3. Return stats if requested
    if (wantStats) {
      const stats = await getProviderStats();
      return NextResponse.json({ stats });
    }

    // 4. Get providers (optionally filtered by category)
    const providers = await listProviders(categoryParam || undefined);

    return NextResponse.json({
      providers: providers.map((p) => ({
        platform: p.platform,
        displayName: p.displayName,
        category: p.category,
        isEnabled: p.isEnabled,
        isConfigured: p.isConfigured,
        iconUrl: p.iconUrl,
      })),
    });
  } catch (error) {
    console.error("[Admin Integration Providers] GET Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get providers" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/integration-providers
 *
 * Enable or disable an integration provider.
 * Body: { platform: IntegrationPlatform, enabled: boolean }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Check admin permission
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const parseResult = updateProviderSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { platform, enabled } = parseResult.data;

    // 4. Get current provider state
    const provider = await getProvider(platform as IntegrationPlatform);
    if (!provider) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Provider ${platform} not found` } },
        { status: 404 }
      );
    }

    // 5. Check if configured before enabling
    if (enabled && !provider.isConfigured) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_CONFIGURED",
            message: `${platform} OAuth credentials are not configured. Set environment variables or use sync endpoint.`,
          },
        },
        { status: 400 }
      );
    }

    // 6. Update provider
    await setProviderEnabled(platform as IntegrationPlatform, enabled);

    // 7. Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "UPDATE",
      resource: "SETTING",
      resourceId: `integration-provider:${platform}`,
      resourceName: `Integration Provider: ${platform}`,
      details: {
        platform,
        enabled,
        action: enabled ? "provider_enabled" : "provider_disabled",
      },
    });

    console.log(
      `[Admin Integration Providers] ${platform} ${enabled ? "enabled" : "disabled"} by user=${user.id}`
    );

    return NextResponse.json({
      success: true,
      platform,
      enabled,
    });
  } catch (error) {
    console.error("[Admin Integration Providers] PUT Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update provider" } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/integration-providers
 *
 * Sync providers from environment variables to database.
 * This is a system-level operation that encrypts credentials.
 *
 * Body: { systemOrgId: string } - Org ID to use for credential encryption
 *
 * Note: This should typically be run during initial setup or when
 * environment variables change.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Check authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // 2. Check admin permission
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const parseResult = syncProvidersSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body. Provide systemOrgId for credential encryption.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { systemOrgId } = parseResult.data;

    // 4. Sync providers
    console.log(`[Admin Integration Providers] Syncing providers with systemOrgId=${systemOrgId}`);
    const result = await syncProvidersFromEnv(systemOrgId);

    // 5. Audit log
    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "CREATE",
      resource: "SETTING",
      resourceId: "integration-providers-sync",
      resourceName: "Integration Providers Sync",
      details: {
        action: "providers_synced",
        synced: result.synced,
        skipped: result.skipped,
      },
    });

    return NextResponse.json({
      success: true,
      synced: result.synced,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("[Admin Integration Providers] POST Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to sync providers" } },
      { status: 500 }
    );
  }
}
