/**
 * Location-Based Access Control Service
 *
 * Provides functions to check and manage user access to locations and their data.
 * Access follows a hierarchical model where access to a parent location
 * grants access to all child locations.
 *
 * Hierarchy: HEADQUARTERS -> REGION -> DISTRICT -> STORE
 */

import { prisma } from "@/lib/db";
import { LocationAccessLevel, LocationType, UserRole } from "@prisma/client";

export type { LocationAccessLevel };

// ============================================
// TYPES
// ============================================

export interface LocationWithHierarchy {
  id: string;
  name: string;
  type: LocationType;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  childIds: string[];
}

export interface UserLocationAccess {
  locationId: string;
  locationName: string;
  locationType: LocationType;
  accessLevel: LocationAccessLevel;
  isInherited: boolean;
  inheritedFrom?: {
    locationId: string;
    locationName: string;
  };
}

// Location type hierarchy (higher index = higher in hierarchy)
const LOCATION_HIERARCHY: LocationType[] = [
  "STORE",
  "DISTRICT",
  "REGION",
  "HEADQUARTERS",
];

// ============================================
// LOCATION HIERARCHY HELPERS
// ============================================

/**
 * Get all descendant location IDs for a given location (recursive)
 */
async function getDescendantLocationIds(
  locationId: string,
  orgId: string
): Promise<string[]> {
  const descendants: string[] = [];

  async function collectDescendants(parentId: string) {
    const children = await prisma.location.findMany({
      where: {
        parentId,
        orgId,
        isActive: true,
      },
      select: { id: true },
    });

    for (const child of children) {
      descendants.push(child.id);
      await collectDescendants(child.id);
    }
  }

  await collectDescendants(locationId);
  return descendants;
}

/**
 * Get all ancestor location IDs for a given location (up to root)
 */
async function getAncestorLocationIds(locationId: string): Promise<string[]> {
  const ancestors: string[] = [];
  let currentId: string | null = locationId;

  while (currentId) {
    const foundLocation: { parentId: string | null } | null = await prisma.location.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });

    if (foundLocation?.parentId) {
      ancestors.push(foundLocation.parentId);
      currentId = foundLocation.parentId;
    } else {
      break;
    }
  }

  return ancestors;
}

// ============================================
// ACCESS CHECKING FUNCTIONS
// ============================================

/**
 * Get all locations a user can access (including inherited from parent locations)
 */
export async function getAccessibleLocations(
  userId: string,
  orgId: string
): Promise<UserLocationAccess[]> {
  // First check if user is admin - admins have access to all locations
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, orgId: true },
  });

  if (!user || user.orgId !== orgId) {
    return [];
  }

  // Admins have MANAGE access to all locations
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    const allLocations = await prisma.location.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true, type: true },
    });

    return allLocations.map((loc) => ({
      locationId: loc.id,
      locationName: loc.name,
      locationType: loc.type,
      accessLevel: LocationAccessLevel.MANAGE,
      isInherited: false,
    }));
  }

  // Get direct location assignments for this user
  const directAccess = await prisma.userLocation.findMany({
    where: { userId },
    include: {
      location: {
        select: { id: true, name: true, type: true, orgId: true, isActive: true },
      },
    },
  });

  // Filter to only include active locations in the same org
  const validDirectAccess = directAccess.filter(
    (ua) => ua.location.orgId === orgId && ua.location.isActive
  );

  const accessMap = new Map<string, UserLocationAccess>();

  // Add direct access
  for (const access of validDirectAccess) {
    accessMap.set(access.locationId, {
      locationId: access.locationId,
      locationName: access.location.name,
      locationType: access.location.type,
      accessLevel: access.accessLevel,
      isInherited: false,
    });

    // Get all descendant locations and add inherited access
    const descendantIds = await getDescendantLocationIds(access.locationId, orgId);
    const descendants = await prisma.location.findMany({
      where: { id: { in: descendantIds }, isActive: true },
      select: { id: true, name: true, type: true },
    });

    for (const desc of descendants) {
      // Only add if not already present or if current access is higher
      const existing = accessMap.get(desc.id);
      if (!existing) {
        accessMap.set(desc.id, {
          locationId: desc.id,
          locationName: desc.name,
          locationType: desc.type,
          accessLevel: access.accessLevel,
          isInherited: true,
          inheritedFrom: {
            locationId: access.locationId,
            locationName: access.location.name,
          },
        });
      }
    }
  }

  return Array.from(accessMap.values());
}

/**
 * Get just the IDs of accessible locations (faster for filtering queries)
 */
export async function getAccessibleLocationIds(
  userId: string,
  orgId: string
): Promise<string[]> {
  const accessibleLocations = await getAccessibleLocations(userId, orgId);
  return accessibleLocations.map((loc) => loc.locationId);
}

/**
 * Check if a user has access to a specific location
 */
export async function canAccessLocation(
  userId: string,
  locationId: string,
  requiredLevel?: LocationAccessLevel
): Promise<boolean> {
  // Get the location to find its org
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { orgId: true, isActive: true },
  });

  if (!location || !location.isActive) {
    return false;
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, orgId: true },
  });

  if (!user || user.orgId !== location.orgId) {
    return false;
  }

  // Admins always have access
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    return true;
  }

  // Check direct access
  const directAccess = await prisma.userLocation.findUnique({
    where: {
      userId_locationId: { userId, locationId },
    },
  });

  if (directAccess) {
    if (!requiredLevel) return true;
    return hasAccessLevel(directAccess.accessLevel, requiredLevel);
  }

  // Check inherited access from ancestor locations
  const ancestorIds = await getAncestorLocationIds(locationId);
  if (ancestorIds.length === 0) {
    return false;
  }

  const ancestorAccess = await prisma.userLocation.findFirst({
    where: {
      userId,
      locationId: { in: ancestorIds },
    },
    orderBy: {
      location: { type: "desc" }, // Check higher-level locations first
    },
  });

  if (!ancestorAccess) {
    return false;
  }

  if (!requiredLevel) return true;
  return hasAccessLevel(ancestorAccess.accessLevel, requiredLevel);
}

/**
 * Check if user can access a specific meeting based on its location
 */
export async function canAccessMeeting(
  userId: string,
  meetingId: string,
  requiredLevel?: LocationAccessLevel
): Promise<boolean> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { orgId: true, locationId: true, createdById: true },
  });

  if (!meeting) {
    return false;
  }

  // Creator always has access
  if (meeting.createdById === userId) {
    return true;
  }

  // Check if user is in the same org
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, orgId: true },
  });

  if (!user || user.orgId !== meeting.orgId) {
    return false;
  }

  // Admins always have access
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    return true;
  }

  // If meeting has no location, only creator and admins can access
  if (!meeting.locationId) {
    return false;
  }

  // Check location-based access
  return canAccessLocation(userId, meeting.locationId, requiredLevel);
}

/**
 * Get the user's access level for a specific location
 */
export async function getUserAccessLevel(
  userId: string,
  locationId: string
): Promise<LocationAccessLevel | null> {
  // Get the location to find its org
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { orgId: true, isActive: true },
  });

  if (!location || !location.isActive) {
    return null;
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, orgId: true },
  });

  if (!user || user.orgId !== location.orgId) {
    return null;
  }

  // Admins always have MANAGE access
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
    return LocationAccessLevel.MANAGE;
  }

  // Check direct access
  const directAccess = await prisma.userLocation.findUnique({
    where: {
      userId_locationId: { userId, locationId },
    },
  });

  if (directAccess) {
    return directAccess.accessLevel;
  }

  // Check inherited access from ancestor locations
  const ancestorIds = await getAncestorLocationIds(locationId);
  if (ancestorIds.length === 0) {
    return null;
  }

  const ancestorAccess = await prisma.userLocation.findFirst({
    where: {
      userId,
      locationId: { in: ancestorIds },
    },
    orderBy: {
      location: { type: "desc" },
    },
  });

  return ancestorAccess?.accessLevel ?? null;
}

// ============================================
// ACCESS LEVEL HELPERS
// ============================================

/**
 * Check if an access level meets the required level
 * MANAGE > EDIT > VIEW
 */
function hasAccessLevel(
  actual: LocationAccessLevel,
  required: LocationAccessLevel
): boolean {
  const levels: LocationAccessLevel[] = [
    LocationAccessLevel.VIEW,
    LocationAccessLevel.EDIT,
    LocationAccessLevel.MANAGE,
  ];

  const actualIndex = levels.indexOf(actual);
  const requiredIndex = levels.indexOf(required);

  return actualIndex >= requiredIndex;
}

/**
 * Get the minimum access level that allows editing
 */
export function getEditAccessLevel(): LocationAccessLevel {
  return LocationAccessLevel.EDIT;
}

/**
 * Get the minimum access level that allows managing (assigning access)
 */
export function getManageAccessLevel(): LocationAccessLevel {
  return LocationAccessLevel.MANAGE;
}

// ============================================
// ACCESS MANAGEMENT FUNCTIONS
// ============================================

/**
 * Assign location access to a user
 */
export async function assignLocationAccess(params: {
  userId: string;
  locationId: string;
  accessLevel: LocationAccessLevel;
  grantedById: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, locationId, accessLevel, grantedById, orgId } = params;

  // Verify the granter has MANAGE access to this location
  const granterLevel = await getUserAccessLevel(grantedById, locationId);
  if (granterLevel !== LocationAccessLevel.MANAGE) {
    return { success: false, error: "Insufficient permissions to grant access" };
  }

  // Verify both users are in the same org as the location
  const [targetUser, location] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } }),
    prisma.location.findUnique({
      where: { id: locationId },
      select: { orgId: true },
    }),
  ]);

  if (!targetUser || !location) {
    return { success: false, error: "User or location not found" };
  }

  if (targetUser.orgId !== orgId || location.orgId !== orgId) {
    return { success: false, error: "User or location not in this organization" };
  }

  // Create or update the access assignment
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: { userId, locationId },
    },
    create: {
      userId,
      locationId,
      accessLevel,
      grantedById,
    },
    update: {
      accessLevel,
      grantedById,
      grantedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Remove location access from a user
 */
export async function removeLocationAccess(params: {
  userId: string;
  locationId: string;
  removedById: string;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, locationId, removedById } = params;

  // Verify the remover has MANAGE access to this location
  const removerLevel = await getUserAccessLevel(removedById, locationId);
  if (removerLevel !== LocationAccessLevel.MANAGE) {
    return {
      success: false,
      error: "Insufficient permissions to remove access",
    };
  }

  // Delete the access assignment
  await prisma.userLocation.deleteMany({
    where: { userId, locationId },
  });

  return { success: true };
}

/**
 * Get all users with access to a location
 */
export async function getLocationUsers(
  locationId: string,
  orgId: string
): Promise<
  Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    accessLevel: LocationAccessLevel;
    isInherited: boolean;
    grantedAt: Date;
  }>
> {
  // Get direct assignments
  const directAccess = await prisma.userLocation.findMany({
    where: { locationId },
    include: {
      user: {
        select: { id: true, name: true, email: true, orgId: true },
      },
    },
  });

  // Filter to same org
  const validAccess = directAccess.filter((ua) => ua.user.orgId === orgId);

  // Get admins who have implicit access
  const admins = await prisma.user.findMany({
    where: {
      orgId,
      role: { in: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    },
    select: { id: true, name: true, email: true },
  });

  const result: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    accessLevel: LocationAccessLevel;
    isInherited: boolean;
    grantedAt: Date;
  }> = [];

  // Add direct access users
  for (const access of validAccess) {
    result.push({
      userId: access.userId,
      userName: access.user.name,
      userEmail: access.user.email,
      accessLevel: access.accessLevel,
      isInherited: false,
      grantedAt: access.grantedAt,
    });
  }

  // Add admins (if not already in list)
  const existingUserIds = new Set(result.map((r) => r.userId));
  for (const admin of admins) {
    if (!existingUserIds.has(admin.id)) {
      result.push({
        userId: admin.id,
        userName: admin.name,
        userEmail: admin.email,
        accessLevel: LocationAccessLevel.MANAGE,
        isInherited: true, // Inherited from admin role
        grantedAt: new Date(),
      });
    }
  }

  return result;
}

// ============================================
// LOCATION MANAGEMENT
// ============================================

/**
 * Get location hierarchy for an organization
 */
export async function getLocationHierarchy(orgId: string): Promise<
  Array<{
    id: string;
    name: string;
    type: LocationType;
    code: string | null;
    parentId: string | null;
    isActive: boolean;
    children: Array<{
      id: string;
      name: string;
      type: LocationType;
      code: string | null;
    }>;
    userCount: number;
  }>
> {
  const locations = await prisma.location.findMany({
    where: { orgId },
    include: {
      children: {
        select: { id: true, name: true, type: true, code: true },
        where: { isActive: true },
      },
      _count: {
        select: { userAccess: true },
      },
    },
    orderBy: [{ type: "desc" }, { name: "asc" }],
  });

  return locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    type: loc.type,
    code: loc.code,
    parentId: loc.parentId,
    isActive: loc.isActive,
    children: loc.children,
    userCount: loc._count.userAccess,
  }));
}

/**
 * Create a new location
 */
export async function createLocation(params: {
  orgId: string;
  name: string;
  type: LocationType;
  code?: string;
  parentId?: string;
  address?: Record<string, string | number | boolean | null>;
  timezone?: string;
}): Promise<{ id: string }> {
  const location = await prisma.location.create({
    data: {
      orgId: params.orgId,
      name: params.name,
      type: params.type,
      code: params.code,
      parentId: params.parentId,
      address: params.address ?? undefined,
      timezone: params.timezone,
    },
  });

  return { id: location.id };
}

/**
 * Update a location
 */
export async function updateLocation(
  locationId: string,
  orgId: string,
  params: {
    name?: string;
    code?: string;
    parentId?: string | null;
    address?: Record<string, string | number | boolean | null>;
    timezone?: string;
    isActive?: boolean;
  }
): Promise<{ success: boolean }> {
  // Build the update data object, handling null parentId explicitly
  const updateData: {
    name?: string;
    code?: string;
    parentId?: string | null;
    address?: Record<string, string | number | boolean | null>;
    timezone?: string;
    isActive?: boolean;
  } = {};

  if (params.name !== undefined) updateData.name = params.name;
  if (params.code !== undefined) updateData.code = params.code;
  if (params.parentId !== undefined) updateData.parentId = params.parentId;
  if (params.address !== undefined) updateData.address = params.address;
  if (params.timezone !== undefined) updateData.timezone = params.timezone;
  if (params.isActive !== undefined) updateData.isActive = params.isActive;

  await prisma.location.update({
    where: { id: locationId, orgId },
    data: updateData,
  });

  return { success: true };
}

/**
 * Delete a location (soft delete by setting isActive = false)
 */
export async function deleteLocation(
  locationId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if location has meetings
  const meetingCount = await prisma.meeting.count({
    where: { locationId },
  });

  if (meetingCount > 0) {
    // Soft delete instead
    await prisma.location.update({
      where: { id: locationId, orgId },
      data: { isActive: false },
    });
    return { success: true };
  }

  // Check if location has children
  const childCount = await prisma.location.count({
    where: { parentId: locationId },
  });

  if (childCount > 0) {
    return {
      success: false,
      error: "Cannot delete location with child locations",
    };
  }

  // Hard delete if no meetings or children
  await prisma.location.delete({
    where: { id: locationId, orgId },
  });

  return { success: true };
}
