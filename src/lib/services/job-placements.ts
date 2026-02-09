import { prisma } from "@/lib/db";
import { PlacementStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================
// TYPES
// ============================================

export interface CreatePlacementInput {
  clientId: string;
  employerName: string;
  jobTitle: string;
  hourlyWage?: number | null;
  startDate: Date;
  endDate?: Date | null;
  status?: PlacementStatus;
  notes?: string | null;
}

export interface UpdatePlacementInput {
  employerName?: string;
  jobTitle?: string;
  hourlyWage?: number | null;
  startDate?: Date;
  endDate?: Date | null;
  status?: PlacementStatus;
  notes?: string | null;
}

export interface PlacementFilters {
  status?: PlacementStatus;
  startDateFrom?: Date;
  startDateTo?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PlacementWithClient {
  id: string;
  clientId: string;
  employerName: string;
  jobTitle: string;
  hourlyWage: Decimal | null;
  startDate: Date;
  endDate: Date | null;
  status: PlacementStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface PlacementStats {
  totalPlacements: number;
  activePlacements: number;
  endedPlacements: number;
  terminatedPlacements: number;
  averageWage: number | null;
  placementsByMonth: { month: string; count: number }[];
}

// ============================================
// PLACEMENT CRUD OPERATIONS
// ============================================

/**
 * Create a new job placement for a client
 */
export async function createPlacement(
  orgId: string,
  input: CreatePlacementInput
): Promise<PlacementWithClient> {
  // Verify client belongs to org
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, orgId, deletedAt: null },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const placement = await prisma.jobPlacement.create({
    data: {
      clientId: input.clientId,
      employerName: input.employerName,
      jobTitle: input.jobTitle,
      hourlyWage: input.hourlyWage ? new Prisma.Decimal(input.hourlyWage) : null,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? PlacementStatus.ACTIVE,
      notes: input.notes,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return placement;
}

/**
 * Get a placement by ID
 */
export async function getPlacement(
  placementId: string,
  orgId: string
): Promise<PlacementWithClient | null> {
  const placement = await prisma.jobPlacement.findFirst({
    where: {
      id: placementId,
      client: { orgId, deletedAt: null },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return placement;
}

/**
 * Update a placement
 */
export async function updatePlacement(
  placementId: string,
  orgId: string,
  input: UpdatePlacementInput
): Promise<PlacementWithClient> {
  // Verify placement exists and belongs to org
  const existing = await getPlacement(placementId, orgId);
  if (!existing) {
    throw new Error("Placement not found");
  }

  const updateData: Prisma.JobPlacementUpdateInput = {};

  if (input.employerName !== undefined) updateData.employerName = input.employerName;
  if (input.jobTitle !== undefined) updateData.jobTitle = input.jobTitle;
  if (input.hourlyWage !== undefined) {
    updateData.hourlyWage = input.hourlyWage ? new Prisma.Decimal(input.hourlyWage) : null;
  }
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.endDate !== undefined) updateData.endDate = input.endDate;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const placement = await prisma.jobPlacement.update({
    where: { id: placementId },
    data: updateData,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return placement;
}

/**
 * End a placement (mark as ended or terminated)
 */
export async function endPlacement(
  placementId: string,
  orgId: string,
  status: "ENDED" | "TERMINATED",
  endDate?: Date
): Promise<PlacementWithClient> {
  // Verify placement exists and belongs to org
  const existing = await getPlacement(placementId, orgId);
  if (!existing) {
    throw new Error("Placement not found");
  }

  const placement = await prisma.jobPlacement.update({
    where: { id: placementId },
    data: {
      status,
      endDate: endDate ?? new Date(),
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return placement;
}

/**
 * Delete a placement
 */
export async function deletePlacement(placementId: string, orgId: string): Promise<void> {
  // Verify placement exists and belongs to org
  const existing = await getPlacement(placementId, orgId);
  if (!existing) {
    throw new Error("Placement not found");
  }

  await prisma.jobPlacement.delete({
    where: { id: placementId },
  });
}

/**
 * List placements for a specific client
 */
export async function listClientPlacements(
  clientId: string,
  orgId: string,
  filters: PlacementFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ placements: PlacementWithClient[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.JobPlacementWhereInput = {
    clientId,
    client: { orgId, deletedAt: null },
    ...(filters.status && { status: filters.status }),
    ...(filters.startDateFrom && { startDate: { gte: filters.startDateFrom } }),
    ...(filters.startDateTo && { startDate: { lte: filters.startDateTo } }),
  };

  const [placements, total] = await Promise.all([
    prisma.jobPlacement.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPlacement.count({ where }),
  ]);

  return {
    placements,
    total,
    hasMore: skip + placements.length < total,
  };
}

/**
 * List all placements for an organization
 */
export async function listOrgPlacements(
  orgId: string,
  filters: PlacementFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ placements: PlacementWithClient[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where: Prisma.JobPlacementWhereInput = {
    client: { orgId, deletedAt: null },
    ...(filters.status && { status: filters.status }),
    ...(filters.startDateFrom && { startDate: { gte: filters.startDateFrom } }),
    ...(filters.startDateTo && { startDate: { lte: filters.startDateTo } }),
  };

  const [placements, total] = await Promise.all([
    prisma.jobPlacement.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPlacement.count({ where }),
  ]);

  return {
    placements,
    total,
    hasMore: skip + placements.length < total,
  };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get placement statistics for an organization
 */
export async function getPlacementStats(orgId: string): Promise<PlacementStats> {
  // Get counts by status
  const statusCounts = await prisma.jobPlacement.groupBy({
    by: ["status"],
    where: {
      client: { orgId, deletedAt: null },
    },
    _count: true,
  });

  const statusMap = new Map(statusCounts.map((s) => [s.status, s._count]));
  const totalPlacements = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const activePlacements = statusMap.get(PlacementStatus.ACTIVE) || 0;
  const endedPlacements = statusMap.get(PlacementStatus.ENDED) || 0;
  const terminatedPlacements = statusMap.get(PlacementStatus.TERMINATED) || 0;

  // Calculate average wage for active placements
  const wageStats = await prisma.jobPlacement.aggregate({
    where: {
      client: { orgId, deletedAt: null },
      status: PlacementStatus.ACTIVE,
      hourlyWage: { not: null },
    },
    _avg: { hourlyWage: true },
  });

  const averageWage = wageStats._avg.hourlyWage
    ? parseFloat(wageStats._avg.hourlyWage.toString())
    : null;

  // Get placements by month (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyPlacements = await prisma.jobPlacement.findMany({
    where: {
      client: { orgId, deletedAt: null },
      startDate: { gte: twelveMonthsAgo },
    },
    select: { startDate: true },
  });

  // Group by month
  const monthCounts = new Map<string, number>();
  for (const placement of monthlyPlacements) {
    const monthKey = `${placement.startDate.getFullYear()}-${String(placement.startDate.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
  }

  // Sort and convert to array
  const placementsByMonth = Array.from(monthCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));

  return {
    totalPlacements,
    activePlacements,
    endedPlacements,
    terminatedPlacements,
    averageWage,
    placementsByMonth,
  };
}

/**
 * Get recent placements for dashboard
 */
export async function getRecentPlacements(
  orgId: string,
  limit: number = 5
): Promise<PlacementWithClient[]> {
  return prisma.jobPlacement.findMany({
    where: {
      client: { orgId, deletedAt: null },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get placement rate (clients with active placements / total active clients)
 */
export async function getPlacementRate(orgId: string): Promise<number> {
  const [clientsWithPlacements, totalClients] = await Promise.all([
    prisma.client.count({
      where: {
        orgId,
        deletedAt: null,
        jobPlacements: {
          some: { status: PlacementStatus.ACTIVE },
        },
      },
    }),
    prisma.client.count({
      where: {
        orgId,
        deletedAt: null,
        status: "ACTIVE",
      },
    }),
  ]);

  if (totalClients === 0) return 0;
  return Math.round((clientsWithPlacements / totalClients) * 100);
}
