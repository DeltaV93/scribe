import { prisma } from "@/lib/db";
import { CredentialStatus, Prisma } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface CreateCredentialInput {
  clientId: string;
  name: string;
  issuingOrg?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  documentUrl?: string | null;
  notes?: string | null;
}

export interface UpdateCredentialInput {
  name?: string;
  issuingOrg?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  documentUrl?: string | null;
  notes?: string | null;
}

export interface RenewCredentialInput {
  newExpiryDate: Date;
  newIssueDate?: Date;
  newDocumentUrl?: string | null;
  notes?: string | null;
}

export interface CredentialFilters {
  status?: CredentialStatus;
  expiringWithinDays?: number;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface CredentialWithClient {
  id: string;
  clientId: string;
  name: string;
  issuingOrg: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  status: CredentialStatus;
  documentUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  daysUntilExpiry: number | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    assignedTo: string;
  };
}

export interface ExpiringCredentialAlert {
  credential: CredentialWithClient;
  daysUntilExpiry: number;
  caseManagerId: string;
  caseManagerName: string | null;
  clientName: string;
}

// ============================================
// CREDENTIAL CRUD OPERATIONS
// ============================================

/**
 * Create a new credential for a client
 */
export async function createCredential(
  orgId: string,
  input: CreateCredentialInput
): Promise<CredentialWithClient> {
  // Verify client belongs to org
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, orgId, deletedAt: null },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  // Calculate initial status based on expiry date
  const status = calculateCredentialStatus(input.expiryDate);

  const credential = await prisma.credential.create({
    data: {
      clientId: input.clientId,
      name: input.name,
      issuingOrg: input.issuingOrg,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      status,
      documentUrl: input.documentUrl,
      notes: input.notes,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, assignedTo: true },
      },
    },
  });

  return transformCredential(credential);
}

/**
 * Get a credential by ID
 */
export async function getCredential(
  credentialId: string,
  orgId: string
): Promise<CredentialWithClient | null> {
  const credential = await prisma.credential.findFirst({
    where: {
      id: credentialId,
      client: { orgId, deletedAt: null },
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, assignedTo: true },
      },
    },
  });

  if (!credential) return null;
  return transformCredential(credential);
}

/**
 * Update a credential
 */
export async function updateCredential(
  credentialId: string,
  orgId: string,
  input: UpdateCredentialInput
): Promise<CredentialWithClient> {
  // Verify credential exists and belongs to org
  const existing = await getCredential(credentialId, orgId);
  if (!existing) {
    throw new Error("Credential not found");
  }

  const updateData: Prisma.CredentialUpdateInput = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.issuingOrg !== undefined) updateData.issuingOrg = input.issuingOrg;
  if (input.issueDate !== undefined) updateData.issueDate = input.issueDate;
  if (input.expiryDate !== undefined) {
    updateData.expiryDate = input.expiryDate;
    updateData.status = calculateCredentialStatus(input.expiryDate);
  }
  if (input.documentUrl !== undefined) updateData.documentUrl = input.documentUrl;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const credential = await prisma.credential.update({
    where: { id: credentialId },
    data: updateData,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, assignedTo: true },
      },
    },
  });

  return transformCredential(credential);
}

/**
 * Renew a credential with a new expiry date
 */
export async function renewCredential(
  credentialId: string,
  orgId: string,
  input: RenewCredentialInput
): Promise<CredentialWithClient> {
  // Verify credential exists and belongs to org
  const existing = await getCredential(credentialId, orgId);
  if (!existing) {
    throw new Error("Credential not found");
  }

  const status = calculateCredentialStatus(input.newExpiryDate);

  const credential = await prisma.credential.update({
    where: { id: credentialId },
    data: {
      expiryDate: input.newExpiryDate,
      issueDate: input.newIssueDate ?? new Date(),
      documentUrl: input.newDocumentUrl ?? existing.documentUrl,
      notes: input.notes ?? existing.notes,
      status,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, assignedTo: true },
      },
    },
  });

  return transformCredential(credential);
}

/**
 * Delete a credential
 */
export async function deleteCredential(credentialId: string, orgId: string): Promise<void> {
  // Verify credential exists and belongs to org
  const existing = await getCredential(credentialId, orgId);
  if (!existing) {
    throw new Error("Credential not found");
  }

  await prisma.credential.delete({
    where: { id: credentialId },
  });
}

/**
 * List credentials for a specific client
 */
export async function listClientCredentials(
  clientId: string,
  orgId: string,
  filters: CredentialFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ credentials: CredentialWithClient[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = buildCredentialWhereClause(clientId, orgId, filters);

  const [credentials, total] = await Promise.all([
    prisma.credential.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, assignedTo: true },
        },
      },
      orderBy: [{ status: "asc" }, { expiryDate: "asc" }],
      skip,
      take: limit,
    }),
    prisma.credential.count({ where }),
  ]);

  return {
    credentials: credentials.map(transformCredential),
    total,
    hasMore: skip + credentials.length < total,
  };
}

/**
 * List all credentials for an organization
 */
export async function listOrgCredentials(
  orgId: string,
  filters: CredentialFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ credentials: CredentialWithClient[]; total: number; hasMore: boolean }> {
  const { page = 1, limit = 20 } = pagination;
  const skip = (page - 1) * limit;

  const where = buildCredentialWhereClause(undefined, orgId, filters);

  const [credentials, total] = await Promise.all([
    prisma.credential.findMany({
      where,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, assignedTo: true },
        },
      },
      orderBy: [{ status: "asc" }, { expiryDate: "asc" }],
      skip,
      take: limit,
    }),
    prisma.credential.count({ where }),
  ]);

  return {
    credentials: credentials.map(transformCredential),
    total,
    hasMore: skip + credentials.length < total,
  };
}

// ============================================
// EXPIRY MANAGEMENT
// ============================================

/**
 * Get credentials expiring within a certain number of days
 */
export async function getExpiringCredentials(
  orgId: string,
  daysUntilExpiry: number = 30
): Promise<ExpiringCredentialAlert[]> {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

  const credentials = await prisma.credential.findMany({
    where: {
      client: { orgId, deletedAt: null },
      expiryDate: {
        not: null,
        lte: expiryThreshold,
        gte: new Date(), // Not already expired
      },
      status: { not: CredentialStatus.EXPIRED },
    },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTo: true,
          assignedUser: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  return credentials.map((cred) => ({
    credential: transformCredential(cred),
    daysUntilExpiry: calculateDaysUntilExpiry(cred.expiryDate!),
    caseManagerId: cred.client.assignedTo,
    caseManagerName: cred.client.assignedUser?.name ?? null,
    clientName: `${cred.client.firstName} ${cred.client.lastName}`,
  }));
}

/**
 * Batch update credential statuses based on expiry dates
 * This should be called by a scheduled job daily
 */
export async function updateCredentialStatuses(): Promise<{
  updated: number;
  newlyExpiring: number;
  newlyExpired: number;
}> {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Mark credentials as EXPIRING (within 30 days)
  const expiringResult = await prisma.credential.updateMany({
    where: {
      expiryDate: {
        not: null,
        gt: now,
        lte: thirtyDaysFromNow,
      },
      status: CredentialStatus.ACTIVE,
    },
    data: {
      status: CredentialStatus.EXPIRING,
    },
  });

  // Mark credentials as EXPIRED (past expiry date)
  const expiredResult = await prisma.credential.updateMany({
    where: {
      expiryDate: {
        not: null,
        lt: now,
      },
      status: { not: CredentialStatus.EXPIRED },
    },
    data: {
      status: CredentialStatus.EXPIRED,
    },
  });

  return {
    updated: expiringResult.count + expiredResult.count,
    newlyExpiring: expiringResult.count,
    newlyExpired: expiredResult.count,
  };
}

/**
 * Get credentials that need alerts sent (at 30 days and 7 days before expiry)
 */
export async function getCredentialsNeedingAlerts(
  orgId: string
): Promise<{ at30Days: ExpiringCredentialAlert[]; at7Days: ExpiringCredentialAlert[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 30 days from now (start of day)
  const thirtyDays = new Date(startOfToday);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysEnd = new Date(thirtyDays);
  thirtyDaysEnd.setDate(thirtyDaysEnd.getDate() + 1);

  // 7 days from now (start of day)
  const sevenDays = new Date(startOfToday);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const sevenDaysEnd = new Date(sevenDays);
  sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 1);

  const [at30Days, at7Days] = await Promise.all([
    prisma.credential.findMany({
      where: {
        client: { orgId, deletedAt: null },
        expiryDate: {
          gte: thirtyDays,
          lt: thirtyDaysEnd,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            assignedTo: true,
            assignedUser: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.credential.findMany({
      where: {
        client: { orgId, deletedAt: null },
        expiryDate: {
          gte: sevenDays,
          lt: sevenDaysEnd,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            assignedTo: true,
            assignedUser: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    at30Days: at30Days.map((cred) => ({
      credential: transformCredential(cred),
      daysUntilExpiry: 30,
      caseManagerId: cred.client.assignedTo,
      caseManagerName: cred.client.assignedUser?.name ?? null,
      clientName: `${cred.client.firstName} ${cred.client.lastName}`,
    })),
    at7Days: at7Days.map((cred) => ({
      credential: transformCredential(cred),
      daysUntilExpiry: 7,
      caseManagerId: cred.client.assignedTo,
      caseManagerName: cred.client.assignedUser?.name ?? null,
      clientName: `${cred.client.firstName} ${cred.client.lastName}`,
    })),
  };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get credential statistics by type/name
 */
export async function getCredentialStatsByType(
  orgId: string
): Promise<{ name: string; active: number; expiring: number; expired: number }[]> {
  const credentials = await prisma.credential.groupBy({
    by: ["name", "status"],
    where: {
      client: { orgId, deletedAt: null },
    },
    _count: true,
  });

  // Group by credential name
  const statsByName = new Map<
    string,
    { active: number; expiring: number; expired: number }
  >();

  for (const cred of credentials) {
    const existing = statsByName.get(cred.name) || { active: 0, expiring: 0, expired: 0 };
    if (cred.status === CredentialStatus.ACTIVE) {
      existing.active = cred._count;
    } else if (cred.status === CredentialStatus.EXPIRING) {
      existing.expiring = cred._count;
    } else if (cred.status === CredentialStatus.EXPIRED) {
      existing.expired = cred._count;
    }
    statsByName.set(cred.name, existing);
  }

  return Array.from(statsByName.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get credential expiration forecast (next 90 days)
 */
export async function getExpirationForecast(
  orgId: string
): Promise<{ week: string; count: number }[]> {
  const now = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const credentials = await prisma.credential.findMany({
    where: {
      client: { orgId, deletedAt: null },
      expiryDate: {
        not: null,
        gte: now,
        lte: ninetyDaysFromNow,
      },
    },
    select: { expiryDate: true },
  });

  // Group by week
  const weekCounts = new Map<string, number>();

  for (const cred of credentials) {
    if (!cred.expiryDate) continue;
    const weekNumber = getWeekNumber(cred.expiryDate);
    const weekKey = `${cred.expiryDate.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
    weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
  }

  return Array.from(weekCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateCredentialStatus(expiryDate: Date | null | undefined): CredentialStatus {
  if (!expiryDate) return CredentialStatus.ACTIVE;

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiryDate < now) {
    return CredentialStatus.EXPIRED;
  } else if (expiryDate <= thirtyDaysFromNow) {
    return CredentialStatus.EXPIRING;
  }
  return CredentialStatus.ACTIVE;
}

function calculateDaysUntilExpiry(expiryDate: Date): number {
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function buildCredentialWhereClause(
  clientId: string | undefined,
  orgId: string,
  filters: CredentialFilters
): Prisma.CredentialWhereInput {
  const where: Prisma.CredentialWhereInput = {
    client: { orgId, deletedAt: null },
  };

  if (clientId) {
    where.clientId = clientId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.expiringWithinDays !== undefined) {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + filters.expiringWithinDays);
    where.expiryDate = {
      not: null,
      lte: expiryThreshold,
      gte: new Date(),
    };
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { issuingOrg: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function transformCredential(credential: Prisma.CredentialGetPayload<{
  include: { client: { select: { id: true; firstName: true; lastName: true; assignedTo: true } } };
}>): CredentialWithClient {
  return {
    id: credential.id,
    clientId: credential.clientId,
    name: credential.name,
    issuingOrg: credential.issuingOrg,
    issueDate: credential.issueDate,
    expiryDate: credential.expiryDate,
    status: credential.status,
    documentUrl: credential.documentUrl,
    notes: credential.notes,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt,
    daysUntilExpiry: credential.expiryDate
      ? calculateDaysUntilExpiry(credential.expiryDate)
      : null,
    client: credential.client,
  };
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
