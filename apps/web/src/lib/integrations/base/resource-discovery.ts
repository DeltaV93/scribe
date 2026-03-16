/**
 * Resource Discovery Service (PX-1002)
 *
 * Discovers and stores platform resources (teams, projects, databases)
 * after successful OAuth connection. Resources are used for destination
 * selection when pushing outputs.
 */

import { prisma } from "@/lib/db";
import { IntegrationPlatform, ResourceType, Prisma } from "@prisma/client";
import type { PlatformResources } from "./adapter";
import { resourceToDbFormat } from "./adapter";
import { getWorkflowService } from "./registry";
import { getIntegrationConnection } from "./token-store";
import { isWorkflowPlatform } from "./types";

// ============================================
// Resource Discovery
// ============================================

/**
 * Discover and store resources for a connection
 *
 * Called after successful OAuth to populate destination options.
 * Replaces existing resources for the connection.
 */
export async function discoverAndStoreResources(
  connectionId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  // Get connection with token
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
    include: { integrationToken: true },
  });

  if (!connection) {
    return { success: false, count: 0, error: "Connection not found" };
  }

  // Get decrypted access token
  const connectionData = await getIntegrationConnection(
    connection.orgId,
    connection.platform
  );

  if (!connectionData?.accessToken) {
    return { success: false, count: 0, error: "No access token available" };
  }

  try {
    // Check if this is a workflow platform
    if (!isWorkflowPlatform(connection.platform)) {
      return { success: false, count: 0, error: "Platform does not support resource discovery" };
    }

    // Get the service for this platform
    const service = getWorkflowService(connection.platform);

    // Check if service has discoverResources method
    if (!("discoverResources" in service)) {
      return { success: false, count: 0, error: "Platform does not support resource discovery" };
    }

    // Discover resources
    const resources = await (service as { discoverResources: (token: string) => Promise<PlatformResources> }).discoverResources(
      connectionData.accessToken
    );

    // Store resources in database
    const count = await storeResources(connectionId, resources);

    console.log(
      `[Resource Discovery] Discovered ${count} resources for ${connection.platform} connection ${connectionId}`
    );

    return { success: true, count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[Resource Discovery] Failed for connection ${connectionId}:`,
      error
    );
    return { success: false, count: 0, error: message };
  }
}

/**
 * Store discovered resources in the database
 *
 * Replaces all existing resources for the connection.
 */
async function storeResources(
  connectionId: string,
  resources: PlatformResources
): Promise<number> {
  // Delete existing resources for this connection
  await prisma.integrationResource.deleteMany({
    where: { connectionId },
  });

  const toCreate: Prisma.IntegrationResourceCreateManyInput[] = [];

  // Convert each resource type
  if (resources.workspaces) {
    for (const ws of resources.workspaces) {
      toCreate.push(
        resourceToDbFormat(connectionId, "WORKSPACE", {
          id: ws.id,
          name: ws.name,
          url: ws.url,
        })
      );
    }
  }

  if (resources.teams) {
    for (const team of resources.teams) {
      toCreate.push(
        resourceToDbFormat(connectionId, "TEAM", {
          id: team.id,
          name: team.name,
          parentId: team.workspaceId,
        })
      );
    }
  }

  if (resources.projects) {
    for (const project of resources.projects) {
      toCreate.push(
        resourceToDbFormat(connectionId, "PROJECT", {
          id: project.id,
          name: project.name,
          parentId: project.teamId,
          key: project.key,
        })
      );
    }
  }

  if (resources.databases) {
    for (const db of resources.databases) {
      toCreate.push(
        resourceToDbFormat(connectionId, "DATABASE", {
          id: db.id,
          name: db.name,
          parentId: db.parentId,
        })
      );
    }
  }

  if (resources.channels) {
    for (const channel of resources.channels) {
      toCreate.push(
        resourceToDbFormat(connectionId, "CHANNEL", {
          id: channel.id,
          name: channel.name,
          isPrivate: channel.isPrivate,
        })
      );
    }
  }

  if (resources.folders) {
    for (const folder of resources.folders) {
      toCreate.push(
        resourceToDbFormat(connectionId, "FOLDER", {
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
        })
      );
    }
  }

  // Batch create
  if (toCreate.length > 0) {
    await prisma.integrationResource.createMany({
      data: toCreate,
    });
  }

  return toCreate.length;
}

// ============================================
// Resource Retrieval
// ============================================

/**
 * Get all resources for a connection
 */
export async function getConnectionResources(
  connectionId: string
): Promise<{
  workspaces: Array<{ id: string; externalId: string; name: string }>;
  teams: Array<{ id: string; externalId: string; name: string; workspaceId?: string }>;
  projects: Array<{ id: string; externalId: string; name: string; teamId?: string; key?: string }>;
  databases: Array<{ id: string; externalId: string; name: string }>;
  channels: Array<{ id: string; externalId: string; name: string }>;
  folders: Array<{ id: string; externalId: string; name: string }>;
}> {
  const resources = await prisma.integrationResource.findMany({
    where: { connectionId },
    orderBy: { name: "asc" },
  });

  const result = {
    workspaces: [] as Array<{ id: string; externalId: string; name: string }>,
    teams: [] as Array<{ id: string; externalId: string; name: string; workspaceId?: string }>,
    projects: [] as Array<{ id: string; externalId: string; name: string; teamId?: string; key?: string }>,
    databases: [] as Array<{ id: string; externalId: string; name: string }>,
    channels: [] as Array<{ id: string; externalId: string; name: string }>,
    folders: [] as Array<{ id: string; externalId: string; name: string }>,
  };

  for (const resource of resources) {
    const base = {
      id: resource.id,
      externalId: resource.externalId,
      name: resource.name,
    };
    const metadata = resource.metadata as Record<string, unknown> | null;

    switch (resource.resourceType) {
      case "WORKSPACE":
        result.workspaces.push(base);
        break;
      case "TEAM":
        result.teams.push({
          ...base,
          workspaceId: resource.parentId ?? undefined,
        });
        break;
      case "PROJECT":
        result.projects.push({
          ...base,
          teamId: resource.parentId ?? undefined,
          key: metadata?.key as string | undefined,
        });
        break;
      case "DATABASE":
        result.databases.push(base);
        break;
      case "CHANNEL":
        result.channels.push(base);
        break;
      case "FOLDER":
        result.folders.push(base);
        break;
    }
  }

  return result;
}

/**
 * Get resources for an org's platform connection
 */
export async function getOrgPlatformResources(
  orgId: string,
  platform: IntegrationPlatform
): Promise<ReturnType<typeof getConnectionResources> | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { orgId, platform, isActive: true },
  });

  if (!connection) {
    return null;
  }

  return getConnectionResources(connection.id);
}

/**
 * Refresh resources for a connection (re-discover)
 */
export async function refreshResources(
  connectionId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  return discoverAndStoreResources(connectionId);
}
